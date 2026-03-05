import { err, ok, type Result } from 'neverthrow';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { permissionStore, toolStore } from '@/app/backend/persistence/stores';
import type { ToolRecord } from '@/app/backend/persistence/types';
import type { ToolInvokeInput } from '@/app/backend/runtime/contracts';
import { resolveEffectivePermissionPolicy } from '@/app/backend/runtime/services/permissions/policyResolver';
import { runtimeEventLogService } from '@/app/backend/runtime/services/runtimeEventLog';
import { appLog } from '@/app/main/logging';

interface ToolOutputEntry {
    path: string;
    kind: 'file' | 'directory';
}

type ToolExecutionResult =
    | {
          ok: true;
          toolId: string;
          output: Record<string, unknown>;
          at: string;
          policy: { effective: 'ask' | 'allow' | 'deny'; source: string };
      }
    | {
          ok: false;
          toolId: string;
          error:
              | 'tool_not_found'
              | 'policy_denied'
              | 'permission_required'
              | 'invalid_args'
              | 'not_implemented'
              | 'execution_failed';
          message: string;
          args: Record<string, unknown>;
          at: string;
          policy?: { effective: 'ask' | 'allow' | 'deny'; source: string };
          requestId?: string;
      };

interface ToolExecutionFailure {
    code: 'invalid_args' | 'not_implemented' | 'execution_failed';
    message: string;
}

function readStringArg(args: Record<string, unknown>, key: string): string | undefined {
    const value = args[key];
    if (value === undefined) {
        return undefined;
    }
    return typeof value === 'string' ? value.trim() : undefined;
}

function readBooleanArg(args: Record<string, unknown>, key: string, fallback: boolean): boolean {
    const value = args[key];
    return typeof value === 'boolean' ? value : fallback;
}

function readNumberArg(args: Record<string, unknown>, key: string, fallback: number): number {
    const value = args[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    return fallback;
}

function normalizeToolPath(targetPath: string | undefined): string {
    if (!targetPath || targetPath.length === 0) {
        return process.cwd();
    }

    if (path.isAbsolute(targetPath)) {
        return path.normalize(targetPath);
    }

    return path.resolve(process.cwd(), targetPath);
}

function resolveAbsoluteToolPath(targetPath: string | undefined): Result<string, ToolExecutionFailure> {
    const normalizedPath = normalizeToolPath(targetPath);
    if (!path.isAbsolute(normalizedPath)) {
        return err({
            code: 'invalid_args',
            message: 'Tool path must resolve to an absolute path.',
        });
    }

    return ok(path.normalize(normalizedPath));
}

async function listFilesTool(args: Record<string, unknown>): Promise<Record<string, unknown>> {
    const rootPathResult = resolveAbsoluteToolPath(readStringArg(args, 'path'));
    if (rootPathResult.isErr()) {
        throw new Error(rootPathResult.error.message);
    }
    const rootPath = rootPathResult.value;
    const includeHidden = readBooleanArg(args, 'includeHidden', false);
    const recursive = readBooleanArg(args, 'recursive', false);
    const maxEntries = Math.max(1, Math.floor(readNumberArg(args, 'maxEntries', 200)));
    const entries: ToolOutputEntry[] = [];
    const queue = [rootPath];

    while (queue.length > 0 && entries.length < maxEntries) {
        const current = queue.shift();
        if (!current) {
            continue;
        }

        // eslint-disable-next-line security/detect-non-literal-fs-filename -- current is normalized absolute path from validated tool args.
        const dirents = await readdir(current, { withFileTypes: true });
        for (const dirent of dirents) {
            if (!includeHidden && dirent.name.startsWith('.')) {
                continue;
            }

            const itemPath = path.join(current, dirent.name);
            if (dirent.isDirectory()) {
                entries.push({ path: itemPath, kind: 'directory' });
                if (recursive) {
                    queue.push(itemPath);
                }
            } else if (dirent.isFile()) {
                entries.push({ path: itemPath, kind: 'file' });
            }

            if (entries.length >= maxEntries) {
                break;
            }
        }
    }

    return {
        rootPath,
        entries,
        truncated: queue.length > 0 || entries.length >= maxEntries,
        count: entries.length,
    };
}

async function readFileTool(
    args: Record<string, unknown>
): Promise<Result<Record<string, unknown>, ToolExecutionFailure>> {
    const fileArg = readStringArg(args, 'path');
    if (!fileArg) {
        return err({
            code: 'invalid_args',
            message: 'Missing "path" argument.',
        });
    }

    const maxBytes = Math.max(1, Math.floor(readNumberArg(args, 'maxBytes', 200_000)));
    const targetPathResult = resolveAbsoluteToolPath(fileArg);
    if (targetPathResult.isErr()) {
        return err(targetPathResult.error);
    }
    const targetPath = targetPathResult.value;
    try {
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- targetPath is normalized absolute path from validated tool args.
        const buffer = await readFile(targetPath);
        const truncated = buffer.byteLength > maxBytes;
        const content = buffer.subarray(0, maxBytes).toString('utf8');

        return ok({
            path: targetPath,
            content,
            byteLength: buffer.byteLength,
            truncated,
        });
    } catch (error) {
        return err({
            code: 'execution_failed',
            message: error instanceof Error ? error.message : String(error),
        });
    }
}

async function executeTool(
    tool: ToolRecord,
    args: Record<string, unknown>
): Promise<Result<Record<string, unknown>, ToolExecutionFailure>> {
    if (tool.id === 'list_files') {
        try {
            return ok(await listFilesTool(args));
        } catch (error) {
            return err({
                code: 'execution_failed',
                message: error instanceof Error ? error.message : String(error),
            });
        }
    }

    if (tool.id === 'read_file') {
        return readFileTool(args);
    }

    if (tool.id === 'run_command') {
        return err({
            code: 'not_implemented',
            message: 'Tool "run_command" is not implemented yet.',
        });
    }

    return err({
        code: 'not_implemented',
        message: `Tool "${tool.id}" is not implemented.`,
    });
}

export class ToolExecutionService {
    async invoke(input: ToolInvokeInput): Promise<ToolExecutionResult> {
        const at = new Date().toISOString();
        const args = input.args ?? {};
        const tools = await toolStore.list();
        const tool = tools.find((candidate) => candidate.id === input.toolId);

        if (!tool) {
            appLog.warn({
                tag: 'tool-execution',
                message: 'Rejected tool invocation because tool was not found.',
                profileId: input.profileId,
                toolId: input.toolId,
                topLevelTab: input.topLevelTab,
                modeKey: input.modeKey,
            });
            return {
                ok: false,
                toolId: input.toolId,
                error: 'tool_not_found',
                message: `Tool "${input.toolId}" was not found.`,
                args,
                at,
            };
        }

        const resource = `tool:${tool.id}`;
        const resolvedPolicy = await resolveEffectivePermissionPolicy({
            profileId: input.profileId,
            resource,
            topLevelTab: input.topLevelTab,
            modeKey: input.modeKey,
            toolDefaultPolicy: tool.permissionPolicy,
            ...(input.workspaceFingerprint ? { workspaceFingerprint: input.workspaceFingerprint } : {}),
        });

        if (resolvedPolicy.policy === 'deny') {
            await runtimeEventLogService.append({
                entityType: 'tool',
                entityId: tool.id,
                eventType: 'tool.invocation.blocked',
                payload: {
                    profileId: input.profileId,
                    toolId: tool.id,
                    resource,
                    policy: resolvedPolicy.policy,
                    source: resolvedPolicy.source,
                    reason: 'policy_denied',
                },
            });

            appLog.warn({
                tag: 'tool-execution',
                message: 'Blocked tool invocation by deny policy.',
                profileId: input.profileId,
                toolId: tool.id,
                source: resolvedPolicy.source,
                topLevelTab: input.topLevelTab,
                modeKey: input.modeKey,
            });
            return {
                ok: false,
                toolId: tool.id,
                error: 'policy_denied',
                message: `Tool "${tool.id}" is denied by current policy (${resolvedPolicy.source}).`,
                args,
                at,
                policy: {
                    effective: resolvedPolicy.policy,
                    source: resolvedPolicy.source,
                },
            };
        }

        if (resolvedPolicy.policy === 'ask') {
            const request = await permissionStore.create({
                policy: 'ask',
                resource,
                rationale: `Tool invocation requires confirmation (${tool.id}).`,
            });

            await runtimeEventLogService.append({
                entityType: 'permission',
                entityId: request.id,
                eventType: 'permission.requested',
                payload: {
                    request,
                    source: 'tool.invoke',
                    toolId: tool.id,
                },
            });

            await runtimeEventLogService.append({
                entityType: 'tool',
                entityId: tool.id,
                eventType: 'tool.invocation.blocked',
                payload: {
                    profileId: input.profileId,
                    toolId: tool.id,
                    resource,
                    policy: resolvedPolicy.policy,
                    source: resolvedPolicy.source,
                    reason: 'permission_required',
                    requestId: request.id,
                },
            });

            appLog.info({
                tag: 'tool-execution',
                message: 'Tool invocation requires permission approval.',
                profileId: input.profileId,
                toolId: tool.id,
                requestId: request.id,
                source: resolvedPolicy.source,
                topLevelTab: input.topLevelTab,
                modeKey: input.modeKey,
            });
            return {
                ok: false,
                toolId: tool.id,
                error: 'permission_required',
                message: `Tool "${tool.id}" requires permission approval.`,
                args,
                at,
                requestId: request.id,
                policy: {
                    effective: resolvedPolicy.policy,
                    source: resolvedPolicy.source,
                },
            };
        }

        const execution = await executeTool(tool, args);
        if (execution.isOk()) {
            const output = execution.value;
            await runtimeEventLogService.append({
                entityType: 'tool',
                entityId: tool.id,
                eventType: 'tool.invocation.completed',
                payload: {
                    profileId: input.profileId,
                    toolId: tool.id,
                    resource,
                    policy: resolvedPolicy.policy,
                    source: resolvedPolicy.source,
                },
            });

            appLog.debug({
                tag: 'tool-execution',
                message: 'Completed tool invocation.',
                profileId: input.profileId,
                toolId: tool.id,
                source: resolvedPolicy.source,
                topLevelTab: input.topLevelTab,
                modeKey: input.modeKey,
            });
            return {
                ok: true,
                toolId: tool.id,
                output,
                at,
                policy: {
                    effective: resolvedPolicy.policy,
                    source: resolvedPolicy.source,
                },
            };
        }

        const code = execution.error.code;
        const message = execution.error.message;

        await runtimeEventLogService.append({
            entityType: 'tool',
            entityId: tool.id,
            eventType: 'tool.invocation.failed',
            payload: {
                profileId: input.profileId,
                toolId: tool.id,
                resource,
                policy: resolvedPolicy.policy,
                source: resolvedPolicy.source,
                error: message,
            },
        });

        appLog.warn({
            tag: 'tool-execution',
            message: 'Tool invocation failed.',
            profileId: input.profileId,
            toolId: tool.id,
            errorCode: code,
            errorMessage: message,
            source: resolvedPolicy.source,
            topLevelTab: input.topLevelTab,
            modeKey: input.modeKey,
        });
        return {
            ok: false,
            toolId: tool.id,
            error: code,
            message,
            args,
            at,
            policy: {
                effective: resolvedPolicy.policy,
                source: resolvedPolicy.source,
            },
        };
    }
}

export const toolExecutionService = new ToolExecutionService();
