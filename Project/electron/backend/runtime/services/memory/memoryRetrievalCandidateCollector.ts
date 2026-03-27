import { memoryStore, threadStore } from '@/app/backend/persistence/stores';
import { parseEntityId } from '@/app/backend/persistence/stores/shared/rowParsers';
import type { MemoryRecord } from '@/app/backend/persistence/types';
import type { EntityId, RetrievedMemoryMatchReason, TopLevelTab } from '@/app/backend/runtime/contracts';
import {
    isExactScopeMatch,
    matchesStructuredContext,
    scopePriority,
    uniquePromptTerms,
} from '@/app/backend/runtime/services/memory/memoryRetrievalHelpers';

export interface MemoryRetrievalCandidate {
    memory: MemoryRecord;
    matchReason: RetrievedMemoryMatchReason;
    priority: number;
    sourceMemoryId?: EntityId<'mem'>;
    annotations?: string[];
}

export interface MemoryRetrievalCollectedState {
    promptTerms: string[];
    activeMemories: MemoryRecord[];
    baseCandidates: MemoryRetrievalCandidate[];
    threadIds: EntityId<'thr'>[];
    workspaceFingerprint?: string;
}

export interface MemoryRetrievalCandidateCollectorInput {
    profileId: string;
    sessionId: EntityId<'sess'>;
    topLevelTab: TopLevelTab;
    modeKey: string;
    prompt: string;
    workspaceFingerprint?: string;
    runId?: EntityId<'run'>;
}

export async function collectMemoryRetrievalCandidates(
    input: MemoryRetrievalCandidateCollectorInput
): Promise<MemoryRetrievalCollectedState> {
    const sessionThread = await threadStore.getBySessionId(input.profileId, input.sessionId);
    const threadId = sessionThread ? parseEntityId(sessionThread.thread.id, 'threads.id', 'thr') : undefined;
    const inheritedRootThreadId =
        sessionThread &&
        sessionThread.thread.delegatedFromOrchestratorRunId &&
        sessionThread.thread.rootThreadId !== sessionThread.thread.id
            ? parseEntityId(sessionThread.thread.rootThreadId, 'threads.root_thread_id', 'thr')
            : undefined;
    const threadIds = Array.from(
        new Set(
            [threadId, inheritedRootThreadId].filter(
                (value): value is EntityId<'thr'> => typeof value === 'string' && value.length > 0
            )
        )
    );
    const workspaceFingerprint = input.workspaceFingerprint ?? sessionThread?.workspaceFingerprint;
    const promptTerms = uniquePromptTerms(input.prompt);
    const activeMemories = await memoryStore.listByProfile({
        profileId: input.profileId,
        state: 'active',
    });

    const baseCandidates: MemoryRetrievalCandidate[] = [];
    for (const memory of activeMemories) {
        const exactMatchReason = isExactScopeMatch({
            memory,
            ...(input.runId ? { runId: input.runId } : {}),
            ...(threadIds.length > 0 ? { threadIds } : {}),
            ...(workspaceFingerprint ? { workspaceFingerprint } : {}),
        });
        if (exactMatchReason) {
            baseCandidates.push({
                memory,
                matchReason: exactMatchReason,
                priority: scopePriority(memory.scopeKind),
            });
            continue;
        }

        if (
            matchesStructuredContext({
                memory,
                topLevelTab: input.topLevelTab,
                modeKey: input.modeKey,
                ...(workspaceFingerprint ? { workspaceFingerprint } : {}),
                ...(threadIds.length > 0 ? { threadIds } : {}),
                ...(input.runId ? { runId: input.runId } : {}),
            })
        ) {
            baseCandidates.push({
                memory,
                matchReason: 'structured',
                priority: 10 + scopePriority(memory.scopeKind),
            });
        }
    }

    return {
        promptTerms,
        activeMemories,
        baseCandidates: baseCandidates.sort((left, right) => {
            if (left.priority !== right.priority) {
                return left.priority - right.priority;
            }
            if (left.memory.updatedAt !== right.memory.updatedAt) {
                return right.memory.updatedAt.localeCompare(left.memory.updatedAt);
            }

            return left.memory.id.localeCompare(right.memory.id);
        }),
        threadIds,
        ...(workspaceFingerprint !== undefined ? { workspaceFingerprint } : {}),
    };
}
