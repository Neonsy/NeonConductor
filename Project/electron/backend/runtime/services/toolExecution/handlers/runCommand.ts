import { err, ok, type Result } from 'neverthrow';
import { spawn } from 'node:child_process';

import { workspaceShellResolver } from '@/app/backend/runtime/services/environment/workspaceShellResolver';
import { readNumberArg, readStringArg } from '@/app/backend/runtime/services/toolExecution/args';
import { decodeCommandOutput } from '@/app/backend/runtime/services/toolExecution/handlers/commandOutputDecoder';
import { createRunCommandExecutionOutput } from '@/app/backend/runtime/services/toolExecution/toolOutputCompressionPolicy';
import type { ToolExecutionFailure, ToolExecutionOutput } from '@/app/backend/runtime/services/toolExecution/types';

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_TIMEOUT_MS = 60_000;

function resolveTimeoutMs(args: Record<string, unknown>): number {
    const requested = Math.floor(readNumberArg(args, 'timeoutMs', DEFAULT_TIMEOUT_MS));
    if (!Number.isFinite(requested)) {
        return DEFAULT_TIMEOUT_MS;
    }

    return Math.max(1, Math.min(requested, MAX_TIMEOUT_MS));
}

async function resolveShellInvocation(
    command: string
): Promise<Result<{ file: string; args: string[] }, ToolExecutionFailure>> {
    const resolvedShell = await workspaceShellResolver.resolve();
    if (!resolvedShell.resolved || !resolvedShell.spawnFile) {
        return err({
            code: 'execution_failed',
            message: 'No supported shell executable could be resolved for command execution.',
        });
    }

    if (resolvedShell.shellFamily === 'powershell') {
        return ok({
            file: resolvedShell.spawnFile,
            args: ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command],
        });
    }

    if (resolvedShell.shellFamily === 'cmd') {
        return ok({
            file: resolvedShell.spawnFile,
            args: ['/d', '/c', command],
        });
    }

    return ok({
        file: resolvedShell.spawnFile,
        args: ['-lc', command],
    });
}

function okResult<T, E>(value: T): Result<T, E> {
    return ok(value);
}

function errResult<T, E>(error: E): Result<T, E> {
    return err(error);
}

export async function runCommandToolHandler(
    args: Record<string, unknown>,
    context: {
        cwd: string;
        signal?: AbortSignal;
    }
): Promise<Result<ToolExecutionOutput, ToolExecutionFailure>> {
    const command = readStringArg(args, 'command');
    if (!command) {
        return err({
            code: 'invalid_args',
            message: 'Missing "command" argument.',
        });
    }

    const timeoutMs = resolveTimeoutMs(args);
    const invocation = await resolveShellInvocation(command);
    if (invocation.isErr()) {
        return err(invocation.error);
    }

    return new Promise((resolve) => {
        const startedAt = Date.now();
        const stdoutChunks: Buffer[] = [];
        const stderrChunks: Buffer[] = [];
        let timedOut = false;
        let settled = false;

        const child = spawn(invocation.value.file, invocation.value.args, {
            cwd: context.cwd,
            windowsHide: true,
        });

        const timeout = setTimeout(() => {
            timedOut = true;
            child.kill();
        }, timeoutMs);

        const abortHandler = () => {
            if (settled) {
                return;
            }
            child.kill();
        };
        context.signal?.addEventListener('abort', abortHandler, { once: true });

        child.stdout.on('data', (chunk: Buffer | string) => {
            stdoutChunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk));
        });

        child.stderr.on('data', (chunk: Buffer | string) => {
            stderrChunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk));
        });

        child.on('error', (error) => {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(timeout);
            context.signal?.removeEventListener('abort', abortHandler);
            resolve(
                errResult({
                    code: 'execution_failed',
                    message: error.message,
                })
            );
        });

        child.on('close', (exitCode) => {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(timeout);
            context.signal?.removeEventListener('abort', abortHandler);

            const stdout = decodeCommandOutput(Buffer.concat(stdoutChunks), process.platform);
            const stderr = decodeCommandOutput(Buffer.concat(stderrChunks), process.platform);
            const executionOutput = createRunCommandExecutionOutput({
                command,
                cwd: context.cwd,
                exitCode,
                stdout,
                stderr,
                timedOut,
                durationMs: Date.now() - startedAt,
            });

            resolve(
                okResult({
                    ...executionOutput.output,
                    artifactCandidate: executionOutput.artifactCandidate,
                })
            );
        });
    });
}
