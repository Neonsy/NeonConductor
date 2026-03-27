import { useState } from 'react';

import { PROGRESSIVE_QUERY_OPTIONS } from '@/web/lib/query/progressiveQueryOptions';
import { trpc } from '@/web/trpc/client';

import { buildMemoryPanelViewModel } from '@/web/components/conversation/panels/memoryPanelViewModel';
import type { MemoryPanelController, MemoryPanelProps } from '@/web/components/conversation/panels/memoryPanel.types';
import type { EntityId } from '@/shared/contracts';

export async function runProjectionRescan(input: {
    refetch: () => Promise<unknown>;
    clearFeedback: () => void;
    reportError: (message: string) => void;
}): Promise<void> {
    input.clearFeedback();
    try {
        await input.refetch();
    } catch (error) {
        input.reportError(error instanceof Error ? error.message : 'Memory projection edits could not be rescanned.');
    }
}

export function useMemoryPanelController(input: MemoryPanelProps): MemoryPanelController {
    const [includeBroaderScopes, setIncludeBroaderScopes] = useState(true);
    const [feedbackMessage, setFeedbackMessage] = useState<string | undefined>(undefined);
    const [feedbackTone, setFeedbackTone] = useState<'info' | 'error' | 'success'>('info');
    const utils = trpc.useUtils();

    const queryInput = {
        profileId: input.profileId,
        ...(input.workspaceFingerprint ? { workspaceFingerprint: input.workspaceFingerprint } : {}),
        ...(input.sandboxId ? { sandboxId: input.sandboxId } : {}),
        ...(input.threadId ? { threadId: input.threadId } : {}),
        ...(input.runId ? { runId: input.runId } : {}),
        includeBroaderScopes,
    };

    const projectionStatusQuery = trpc.memory.projectionStatus.useQuery(queryInput, PROGRESSIVE_QUERY_OPTIONS);
    const scanProjectionEditsQuery = trpc.memory.scanProjectionEdits.useQuery(queryInput, PROGRESSIVE_QUERY_OPTIONS);

    const invalidateMemoryQueries = async () => {
        await Promise.all([
            utils.memory.projectionStatus.invalidate(queryInput),
            utils.memory.scanProjectionEdits.invalidate(queryInput),
            utils.memory.list.invalidate({ profileId: input.profileId }),
        ]);
    };

    const syncProjectionMutation = trpc.memory.syncProjection.useMutation({
        onSuccess: async () => {
            setFeedbackTone('success');
            setFeedbackMessage('Memory projection synced to disk.');
            await invalidateMemoryQueries();
        },
        onError: (error) => {
            setFeedbackTone('error');
            setFeedbackMessage(error.message);
        },
    });

    const applyProjectionEditMutation = trpc.memory.applyProjectionEdit.useMutation({
        onSuccess: async (result) => {
            setFeedbackTone('success');
            setFeedbackMessage(
                result.decision === 'reject'
                    ? 'Edited memory file was reset to the canonical record.'
                    : `Memory proposal applied as ${result.appliedAction ?? 'update'}.`
            );
            await invalidateMemoryQueries();
        },
        onError: (error) => {
            setFeedbackTone('error');
            setFeedbackMessage(error.message);
        },
    });

    const viewModel = buildMemoryPanelViewModel({
        topLevelTab: input.topLevelTab,
        modeKey: input.modeKey,
        includeBroaderScopes,
        projectionStatus: projectionStatusQuery.data,
        projectionStatusIsFetching: projectionStatusQuery.isFetching,
        scanProjectionEdits: scanProjectionEditsQuery.data,
        scanProjectionEditsIsFetching: scanProjectionEditsQuery.isFetching,
        ...(input.retrievedMemory ? { retrievedMemory: input.retrievedMemory } : {}),
    });

    function clearFeedback(): void {
        setFeedbackMessage(undefined);
        setFeedbackTone('info');
    }

    async function onRescanProjectionEdits(): Promise<void> {
        await runProjectionRescan({
            refetch: () => scanProjectionEditsQuery.refetch(),
            clearFeedback,
            reportError: (message) => {
                setFeedbackTone('error');
                setFeedbackMessage(message);
            },
        });
    }

    return {
        viewModel,
        feedbackMessage,
        feedbackTone,
        clearFeedback,
        setIncludeBroaderScopes,
        isSyncingProjection: syncProjectionMutation.isPending,
        isRescanningProjectionEdits: scanProjectionEditsQuery.isFetching,
        isApplyingProjectionEdit: applyProjectionEditMutation.isPending,
        onRescanProjectionEdits,
        onSyncProjection: () => {
            clearFeedback();
            syncProjectionMutation.mutate(queryInput);
        },
        onApplyProjectionEdit: (projectionEdit: {
            memoryId: EntityId<'mem'>;
            observedContentHash: string;
            decision: 'accept' | 'reject';
        }) => {
            clearFeedback();
            applyProjectionEditMutation.mutate({
                ...queryInput,
                memoryId: projectionEdit.memoryId,
                observedContentHash: projectionEdit.observedContentHash,
                decision: projectionEdit.decision,
            });
        },
    };
}
