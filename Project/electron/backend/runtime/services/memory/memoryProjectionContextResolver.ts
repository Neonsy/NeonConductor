import os from 'node:os';
import path from 'node:path';

import { conversationStore, runStore, threadStore } from '@/app/backend/persistence/stores';
import { parseEntityId } from '@/app/backend/persistence/stores/shared/rowParsers';
import type { MemoryRecord } from '@/app/backend/persistence/types';
import type {
    EntityId,
    MemoryProjectionContextInput,
    MemoryProjectionPaths,
    MemoryProjectionTarget,
} from '@/app/backend/runtime/contracts';
import { errOp, okOp, type OperationalResult } from '@/app/backend/runtime/services/common/operationalError';
import { workspaceContextService } from '@/app/backend/runtime/services/workspaceContext/service';

export interface ResolvedProjectionContext {
    workspaceFingerprint?: string;
    threadId?: EntityId<'thr'>;
    runId?: EntityId<'run'>;
    includeBroaderScopes: boolean;
}

export interface CandidateProjection {
    memory: MemoryRecord;
    projectionTarget: MemoryProjectionTarget;
    absolutePath: string;
    relativePath: string;
}

export async function resolveMemoryProjectionPaths(input: {
    profileId: string;
    workspaceFingerprint?: string;
    sandboxId?: EntityId<'sb'>;
}): Promise<MemoryProjectionPaths> {
    const overrideMemoryRoot = process.env['NEONCONDUCTOR_GLOBAL_MEMORY_ROOT']?.trim();
    const globalMemoryRoot =
        overrideMemoryRoot && path.isAbsolute(overrideMemoryRoot)
            ? overrideMemoryRoot
            : path.join(os.homedir(), '.neonconductor', 'memory');

    if (!input.workspaceFingerprint) {
        return {
            globalMemoryRoot,
        };
    }

    const workspaceRoot = await workspaceContextService.resolveExplicit({
        profileId: input.profileId,
        workspaceFingerprint: input.workspaceFingerprint,
        ...(input.sandboxId ? { sandboxId: input.sandboxId } : {}),
    });

    return {
        globalMemoryRoot,
        ...(workspaceRoot.kind === 'workspace' || workspaceRoot.kind === 'sandbox'
            ? {
                  workspaceMemoryRoot: path.join(
                      workspaceRoot.kind === 'sandbox'
                          ? workspaceRoot.baseWorkspace.absolutePath
                          : workspaceRoot.absolutePath,
                      '.neonconductor',
                      'memory'
                  ),
              }
            : {}),
    };
}

export async function resolveProjectionContext(
    input: MemoryProjectionContextInput
): Promise<OperationalResult<ResolvedProjectionContext>> {
    const includeBroaderScopes = input.includeBroaderScopes ?? true;

    if (input.runId) {
        const run = await runStore.getById(input.runId);
        if (!run || run.profileId !== input.profileId) {
            return errOp('not_found', `Run "${input.runId}" was not found.`);
        }

        const sessionThread = await threadStore.getBySessionId(input.profileId, run.sessionId);
        if (!sessionThread) {
            return errOp('thread_not_found', `Session thread for run "${input.runId}" was not found.`);
        }

        const parsedThreadId = parseEntityId(sessionThread.thread.id, 'threads.id', 'thr');
        if (input.threadId && input.threadId !== parsedThreadId) {
            return errOp('invalid_input', 'Run projection context thread does not match the selected run.');
        }
        if (input.workspaceFingerprint && input.workspaceFingerprint !== sessionThread.workspaceFingerprint) {
            return errOp('invalid_input', 'Run projection context workspace does not match the selected run.');
        }

        return okOp({
            ...(sessionThread.workspaceFingerprint ? { workspaceFingerprint: sessionThread.workspaceFingerprint } : {}),
            threadId: parsedThreadId,
            runId: input.runId,
            includeBroaderScopes,
        });
    }

    if (input.threadId) {
        const thread = await threadStore.getById(input.profileId, input.threadId);
        if (!thread) {
            return errOp('thread_not_found', `Thread "${input.threadId}" was not found.`);
        }

        const conversation = await conversationStore.getBucketById(input.profileId, thread.conversationId);
        if (!conversation) {
            return errOp('conversation_not_found', `Conversation "${thread.conversationId}" was not found.`);
        }

        const derivedWorkspaceFingerprint =
            conversation.scope === 'workspace' ? conversation.workspaceFingerprint : undefined;
        if (input.workspaceFingerprint && input.workspaceFingerprint !== derivedWorkspaceFingerprint) {
            return errOp('invalid_input', 'Thread projection context workspace does not match the selected thread.');
        }

        return okOp({
            ...(derivedWorkspaceFingerprint ? { workspaceFingerprint: derivedWorkspaceFingerprint } : {}),
            threadId: input.threadId,
            includeBroaderScopes,
        });
    }

    return okOp({
        ...(input.workspaceFingerprint ? { workspaceFingerprint: input.workspaceFingerprint } : {}),
        includeBroaderScopes,
    });
}

export function selectProjectionTarget(
    memory: MemoryRecord,
    paths: MemoryProjectionPaths,
    workspaceFingerprint?: string
): MemoryProjectionTarget {
    if (
        memory.scopeKind !== 'global' &&
        memory.workspaceFingerprint &&
        paths.workspaceMemoryRoot &&
        workspaceFingerprint === memory.workspaceFingerprint
    ) {
        return 'workspace';
    }

    return 'global';
}

export function buildCandidateProjectionForTarget(
    memory: MemoryRecord,
    paths: MemoryProjectionPaths,
    projectionTarget: MemoryProjectionTarget
): CandidateProjection {
    const rootPath = projectionTarget === 'workspace' ? paths.workspaceMemoryRoot : paths.globalMemoryRoot;
    if (!rootPath) {
        throw new Error('Workspace-scoped memory projection requires a workspace memory root.');
    }

    const relativePath = path.join(memory.memoryType, `${memory.scopeKind}--${memory.id}.md`);
    return {
        memory,
        projectionTarget,
        absolutePath: path.join(rootPath, relativePath),
        relativePath: relativePath.replace(/\\/g, '/'),
    };
}

export function buildCandidateProjection(
    memory: MemoryRecord,
    paths: MemoryProjectionPaths,
    workspaceFingerprint?: string
): CandidateProjection {
    return buildCandidateProjectionForTarget(memory, paths, selectProjectionTarget(memory, paths, workspaceFingerprint));
}

export function isMemoryRelevant(memory: MemoryRecord, context: ResolvedProjectionContext): boolean {
    if (context.runId) {
        if (!context.includeBroaderScopes) {
            return memory.scopeKind === 'run' && memory.runId === context.runId;
        }

        return (
            memory.scopeKind === 'global' ||
            (memory.scopeKind === 'workspace' && memory.workspaceFingerprint === context.workspaceFingerprint) ||
            (memory.scopeKind === 'thread' && memory.threadId === context.threadId) ||
            (memory.scopeKind === 'run' && memory.runId === context.runId)
        );
    }

    if (context.threadId) {
        if (!context.includeBroaderScopes) {
            return memory.scopeKind === 'thread' && memory.threadId === context.threadId;
        }

        return (
            memory.scopeKind === 'global' ||
            (memory.scopeKind === 'workspace' && memory.workspaceFingerprint === context.workspaceFingerprint) ||
            (memory.scopeKind === 'thread' && memory.threadId === context.threadId)
        );
    }

    if (context.workspaceFingerprint) {
        if (!context.includeBroaderScopes) {
            return memory.scopeKind === 'workspace' && memory.workspaceFingerprint === context.workspaceFingerprint;
        }

        return (
            memory.scopeKind === 'global' ||
            (memory.scopeKind === 'workspace' && memory.workspaceFingerprint === context.workspaceFingerprint)
        );
    }

    return memory.scopeKind === 'global';
}

export function sortProjectedMemories(left: MemoryRecord, right: MemoryRecord): number {
    if (left.updatedAt !== right.updatedAt) {
        return right.updatedAt.localeCompare(left.updatedAt);
    }

    return right.id.localeCompare(left.id);
}
