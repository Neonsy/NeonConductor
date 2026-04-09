import { err, ok, type Result } from 'neverthrow';
import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { VENDORED_NODE_TRANSFORM_HARNESS_SOURCE } from '@/app/backend/runtime/services/codeExecution/vendoredNodeTransformHarness';
import {
    vendoredNodeResolver,
    type ResolvedVendoredNode,
} from '@/app/backend/runtime/services/environment/vendoredNodeResolver';
import type { ToolExecutionFailure } from '@/app/backend/runtime/services/toolExecution/types';

import { VENDORED_NODE_VERSION } from '@/shared/tooling/vendoredNode';

import type { ChildProcessWithoutNullStreams } from 'node:child_process';

const DEFAULT_TIMEOUT_MS = 5_000;
const MAX_TIMEOUT_MS = 30_000;
const MAX_SOURCE_BYTES = 256_000;
const MAX_STDERR_BYTES = 64_000;
const MAX_TRANSPORT_STDOUT_BYTES = 1_000_000;
const HARNESS_FILE_NAME = 'neon-execute-code-harness.mjs';

export interface ExecuteCodeRunnerOutput {
    runtime: 'vendored_node';
    runtimeVersion: string;
    result: unknown;
    resultSerialization: 'json' | 'json_preview' | 'string' | 'undefined' | 'unserializable_text' | 'error';
    resultBytes: number;
    resultTruncated: boolean;
    logs: Array<{
        level: 'debug' | 'error' | 'info' | 'log' | 'warn';
        text: string;
        truncated: boolean;
    }>;
    logsTruncated: boolean;
    stderr: string;
    stderrBytes: number;
    stderrTruncated: boolean;
    timedOut: boolean;
    durationMs: number;
    error?: {
        name: string;
        message: string;
        stack?: string;
    };
}

interface HarnessEnvelope {
    ok: boolean;
    result?: unknown;
    resultSerialization?: ExecuteCodeRunnerOutput['resultSerialization'];
    resultBytes?: number;
    resultTruncated?: boolean;
    logs?: ExecuteCodeRunnerOutput['logs'];
    logsTruncated?: boolean;
    error?: ExecuteCodeRunnerOutput['error'];
    timedOut?: boolean;
    durationMs?: number;
}

interface SpawnedNodeRuntime {
    child: ChildProcessWithoutNullStreams;
}

export interface VendoredNodeCodeRunnerDependencies {
    resolveVendoredNode?: () => Promise<ResolvedVendoredNode>;
    spawnNode?: (executablePath: string, args: string[], options: { cwd: string }) => SpawnedNodeRuntime;
    tempRootPath?: string;
}

function resolveTimeoutMs(timeoutMs: number | undefined): number {
    if (timeoutMs === undefined) {
        return DEFAULT_TIMEOUT_MS;
    }

    const normalized = Math.floor(timeoutMs);
    if (!Number.isFinite(normalized)) {
        return DEFAULT_TIMEOUT_MS;
    }

    return Math.max(1, Math.min(normalized, MAX_TIMEOUT_MS));
}

function validateSource(code: string): Result<null, ToolExecutionFailure> {
    const sourceBytes = Buffer.byteLength(code, 'utf8');
    if (sourceBytes > MAX_SOURCE_BYTES) {
        return err({
            code: 'invalid_args',
            message: `execute_code source is ${String(sourceBytes)} bytes; the limit is ${String(MAX_SOURCE_BYTES)} bytes.`,
        });
    }

    return ok(null);
}

function appendBoundedText(input: {
    chunks: Buffer[];
    currentBytes: number;
    chunk: Buffer | string;
    maxBytes: number;
}): { bytes: number; truncated: boolean } {
    const buffer = typeof input.chunk === 'string' ? Buffer.from(input.chunk, 'utf8') : Buffer.from(input.chunk);
    const remainingBytes = input.maxBytes - input.currentBytes;
    if (remainingBytes <= 0) {
        return { bytes: input.currentBytes + buffer.byteLength, truncated: true };
    }

    if (buffer.byteLength <= remainingBytes) {
        input.chunks.push(buffer);
        return { bytes: input.currentBytes + buffer.byteLength, truncated: false };
    }

    input.chunks.push(buffer.subarray(0, remainingBytes));
    return { bytes: input.currentBytes + buffer.byteLength, truncated: true };
}

function parseHarnessEnvelope(stdoutText: string): Result<HarnessEnvelope, ToolExecutionFailure> {
    try {
        const parsed: unknown = JSON.parse(stdoutText);
        if (isHarnessEnvelope(parsed)) {
            return ok(parsed);
        }
    } catch {
        // Use the normalized error below.
    }

    return err({
        code: 'execution_failed',
        message: 'execute_code runtime returned an unreadable result envelope.',
    });
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isHarnessEnvelope(value: unknown): value is HarnessEnvelope {
    return isRecord(value) && typeof value['ok'] === 'boolean';
}

function createOutput(input: {
    envelope: HarnessEnvelope;
    stderrText: string;
    stderrBytes: number;
    stderrTruncated: boolean;
    timedOut: boolean;
    durationMs: number;
}): ExecuteCodeRunnerOutput {
    return {
        runtime: 'vendored_node',
        runtimeVersion: VENDORED_NODE_VERSION,
        result: input.envelope.result ?? null,
        resultSerialization: input.envelope.resultSerialization ?? 'undefined',
        resultBytes: input.envelope.resultBytes ?? 0,
        resultTruncated: input.envelope.resultTruncated ?? false,
        logs: input.envelope.logs ?? [],
        logsTruncated: input.envelope.logsTruncated ?? false,
        stderr: input.stderrText,
        stderrBytes: input.stderrBytes,
        stderrTruncated: input.stderrTruncated,
        timedOut: input.timedOut || input.envelope.timedOut === true,
        durationMs: input.durationMs,
        ...(input.envelope.error ? { error: input.envelope.error } : {}),
    };
}

type RunnerResult = Result<ExecuteCodeRunnerOutput, ToolExecutionFailure>;
type ResolveRunnerResult = (value: RunnerResult) => void;

function resolveOkRunnerOutput(resolve: ResolveRunnerResult, value: ExecuteCodeRunnerOutput): void {
    const result: RunnerResult = ok(value);
    result.match(
        () => undefined,
        () => undefined
    );
    resolve(result);
}

function resolveErrRunnerOutput(resolve: ResolveRunnerResult, error: ToolExecutionFailure): void {
    const result: RunnerResult = err(error);
    result.match(
        () => undefined,
        () => undefined
    );
    resolve(result);
}

export class VendoredNodeCodeRunner {
    private readonly resolveVendoredNode: () => Promise<ResolvedVendoredNode>;
    private readonly spawnNode: NonNullable<VendoredNodeCodeRunnerDependencies['spawnNode']>;
    private readonly tempRootPath: string;

    constructor(dependencies: VendoredNodeCodeRunnerDependencies = {}) {
        this.resolveVendoredNode = dependencies.resolveVendoredNode ?? (() => vendoredNodeResolver.resolve());
        this.spawnNode =
            dependencies.spawnNode ??
            ((executablePath, args, options) => ({
                child: spawn(executablePath, args, {
                    cwd: options.cwd,
                    env: {
                        NODE_DISABLE_COLORS: '1',
                        NO_COLOR: '1',
                    },
                    windowsHide: true,
                }),
            }));
        this.tempRootPath = dependencies.tempRootPath ?? os.tmpdir();
    }

    async execute(input: {
        code: string;
        timeoutMs?: number;
    }): Promise<Result<ExecuteCodeRunnerOutput, ToolExecutionFailure>> {
        const sourceValidation = validateSource(input.code);
        if (sourceValidation.isErr()) {
            return err(sourceValidation.error);
        }

        const resolvedNode = await this.resolveVendoredNode();
        if (!resolvedNode.available || !resolvedNode.executablePath) {
            return err({
                code: 'execution_failed',
                message:
                    resolvedNode.reason === 'unsupported_target'
                        ? 'Vendored Node runtime is unavailable for this platform/architecture.'
                        : 'Vendored Node runtime asset is missing.',
            });
        }

        await mkdir(this.tempRootPath, { recursive: true });
        const tempDirectoryPath = await mkdtemp(path.join(this.tempRootPath, 'neon-execute-code-'));
        const harnessPath = path.join(tempDirectoryPath, HARNESS_FILE_NAME);

        try {
            await writeFile(harnessPath, VENDORED_NODE_TRANSFORM_HARNESS_SOURCE, 'utf8');
            return await this.executeHarness({
                executablePath: resolvedNode.executablePath,
                harnessPath,
                tempDirectoryPath,
                code: input.code,
                timeoutMs: resolveTimeoutMs(input.timeoutMs),
            });
        } finally {
            await rm(tempDirectoryPath, { recursive: true, force: true });
        }
    }

    private async executeHarness(input: {
        executablePath: string;
        harnessPath: string;
        tempDirectoryPath: string;
        code: string;
        timeoutMs: number;
    }): Promise<Result<ExecuteCodeRunnerOutput, ToolExecutionFailure>> {
        return await new Promise((resolve) => {
            const startedAt = Date.now();
            const stdoutChunks: Buffer[] = [];
            const stderrChunks: Buffer[] = [];
            let stdoutBytes = 0;
            let stderrBytes = 0;
            let stderrTruncated = false;
            let timedOut = false;
            let transportStdoutTruncated = false;
            let settled = false;

            const { child } = this.spawnNode(input.executablePath, ['--permission', input.harnessPath], {
                cwd: input.tempDirectoryPath,
            });

            const timeout = setTimeout(() => {
                timedOut = true;
                child.kill();
            }, input.timeoutMs);

            child.stdout.on('data', (chunk: Buffer | string) => {
                const next = appendBoundedText({
                    chunks: stdoutChunks,
                    currentBytes: stdoutBytes,
                    chunk,
                    maxBytes: MAX_TRANSPORT_STDOUT_BYTES,
                });
                stdoutBytes = next.bytes;
                transportStdoutTruncated ||= next.truncated;
                if (transportStdoutTruncated) {
                    child.kill();
                }
            });

            child.stderr.on('data', (chunk: Buffer | string) => {
                const next = appendBoundedText({
                    chunks: stderrChunks,
                    currentBytes: stderrBytes,
                    chunk,
                    maxBytes: MAX_STDERR_BYTES,
                });
                stderrBytes = next.bytes;
                stderrTruncated ||= next.truncated;
            });

            child.on('error', (error) => {
                if (settled) {
                    return;
                }
                settled = true;
                clearTimeout(timeout);
                resolveErrRunnerOutput(resolve, {
                    code: 'execution_failed',
                    message: error.message,
                });
            });

            child.on('close', () => {
                if (settled) {
                    return;
                }
                settled = true;
                clearTimeout(timeout);

                const stderrText = Buffer.concat(stderrChunks).toString('utf8');
                if (transportStdoutTruncated) {
                    resolveErrRunnerOutput(resolve, {
                        code: 'execution_failed',
                        message: 'execute_code runtime exceeded the transport output limit.',
                    });
                    return;
                }

                if (timedOut) {
                    resolveOkRunnerOutput(
                        resolve,
                        createOutput({
                            envelope: {
                                ok: false,
                                result: null,
                                resultSerialization: 'error',
                                resultBytes: 0,
                                resultTruncated: false,
                                error: {
                                    name: 'TimeoutError',
                                    message: `execute_code timed out after ${String(input.timeoutMs)} ms.`,
                                },
                                timedOut: true,
                            },
                            stderrText,
                            stderrBytes,
                            stderrTruncated,
                            timedOut,
                            durationMs: Date.now() - startedAt,
                        })
                    );
                    return;
                }

                const stdoutText = Buffer.concat(stdoutChunks).toString('utf8');
                const envelope = parseHarnessEnvelope(stdoutText);
                if (envelope.isErr()) {
                    resolveErrRunnerOutput(resolve, envelope.error);
                    return;
                }

                resolveOkRunnerOutput(
                    resolve,
                    createOutput({
                        envelope: envelope.value,
                        stderrText,
                        stderrBytes,
                        stderrTruncated,
                        timedOut,
                        durationMs: Date.now() - startedAt,
                    })
                );
            });

            child.stdin.on('error', () => {
                // Process failure is reported through child error/close.
            });
            child.stdin.end(
                JSON.stringify({
                    code: input.code,
                    timeoutMs: input.timeoutMs,
                })
            );
        });
    }
}

export const vendoredNodeCodeRunner = new VendoredNodeCodeRunner();
