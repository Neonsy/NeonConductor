import { conversationStore, runStore, threadStore } from '@/app/backend/persistence/stores';
import { parseEntityId } from '@/app/backend/persistence/stores/shared/rowParsers';
import type { MemoryCreateInput } from '@/app/backend/runtime/contracts';
import type { EntityId } from '@/app/backend/runtime/contracts';
import { errOp, okOp, type OperationalResult } from '@/app/backend/runtime/services/common/operationalError';

export interface ResolvedMemoryProvenance {
    workspaceFingerprint?: string;
    threadId?: EntityId<'thr'>;
    runId?: EntityId<'run'>;
}

export type MemoryProvenanceInput = Pick<
    MemoryCreateInput,
    'profileId' | 'scopeKind' | 'workspaceFingerprint' | 'threadId' | 'runId'
>;

function validateNoAdditionalProvenance(input: MemoryProvenanceInput): OperationalResult<void> {
    if (input.workspaceFingerprint || input.threadId || input.runId) {
        return errOp('invalid_input', 'This memory scope does not allow workspace, thread, or run provenance.');
    }

    return okOp(undefined);
}

function validateWorkspaceOnlyProvenance(
    input: MemoryProvenanceInput
): OperationalResult<{ workspaceFingerprint: string }> {
    if (!input.workspaceFingerprint) {
        return errOp('invalid_input', 'Workspace-scoped memory requires "workspaceFingerprint".');
    }
    if (input.threadId || input.runId) {
        return errOp('invalid_input', 'Workspace-scoped memory cannot include thread or run provenance.');
    }

    return okOp({
        workspaceFingerprint: input.workspaceFingerprint,
    });
}

export async function resolveCanonicalMemoryProvenance(
    input: MemoryProvenanceInput
): Promise<OperationalResult<ResolvedMemoryProvenance>> {
    if (input.scopeKind === 'global') {
        const validation = validateNoAdditionalProvenance(input);
        if (validation.isErr()) {
            return errOp(validation.error.code, validation.error.message, {
                ...(validation.error.details ? { details: validation.error.details } : {}),
                ...(validation.error.retryable !== undefined ? { retryable: validation.error.retryable } : {}),
            });
        }

        return okOp({});
    }

    if (input.scopeKind === 'workspace') {
        const validation = validateWorkspaceOnlyProvenance(input);
        if (validation.isErr()) {
            return errOp(validation.error.code, validation.error.message, {
                ...(validation.error.details ? { details: validation.error.details } : {}),
                ...(validation.error.retryable !== undefined ? { retryable: validation.error.retryable } : {}),
            });
        }

        return okOp(validation.value);
    }

    if (input.scopeKind === 'thread') {
        if (!input.threadId) {
            return errOp('invalid_input', 'Thread-scoped memory requires "threadId".');
        }
        if (input.runId) {
            return errOp('invalid_input', 'Thread-scoped memory cannot include "runId"; it is derived from the thread.');
        }

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
            return errOp('invalid_input', 'Thread-scoped memory workspace provenance does not match the thread.');
        }

        return okOp({
            ...(derivedWorkspaceFingerprint ? { workspaceFingerprint: derivedWorkspaceFingerprint } : {}),
            threadId: parseEntityId(thread.id, 'threads.id', 'thr'),
        });
    }

    if (!input.runId) {
        return errOp('invalid_input', 'Run-scoped memory requires "runId".');
    }
    if (input.threadId) {
        return errOp('invalid_input', 'Run-scoped memory cannot include "threadId"; it is derived from the run.');
    }

    const run = await runStore.getById(input.runId);
    if (!run || run.profileId !== input.profileId) {
        return errOp('not_found', `Run "${input.runId}" was not found.`);
    }

    const sessionThread = await threadStore.getBySessionId(input.profileId, run.sessionId);
    if (!sessionThread) {
        return errOp('thread_not_found', `Session thread for run "${input.runId}" was not found.`);
    }

    if (input.workspaceFingerprint && input.workspaceFingerprint !== sessionThread.workspaceFingerprint) {
        return errOp('invalid_input', 'Run-scoped memory workspace provenance does not match the run session.');
    }

    return okOp({
        ...(sessionThread.workspaceFingerprint ? { workspaceFingerprint: sessionThread.workspaceFingerprint } : {}),
        threadId: parseEntityId(sessionThread.thread.id, 'threads.id', 'thr'),
        runId: run.id,
    });
}
