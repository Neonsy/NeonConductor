import { useState } from 'react';

import { useConversationMutations } from '@/web/components/conversation/shell/actions/useConversationMutations';
import { isEntityId } from '@/web/components/conversation/shell/workspace/helpers';
import { invalidateShellBootstrap } from '@/web/lib/runtime/invalidation/queryInvalidation';
import { trpc } from '@/web/trpc/client';

import type { PermissionRecord } from '@/app/backend/persistence/types';
import type {
    ConversationSetThreadExecutionEnvironmentInput,
    EntityId,
    PermissionResolution,
} from '@/app/backend/runtime/contracts';

interface UseConversationWorkspaceActionsInput {
    profileId: string;
    mutations: ReturnType<typeof useConversationMutations>;
    onResolvePermission: () => void;
}

export function useConversationWorkspaceActions(input: UseConversationWorkspaceActionsInput) {
    const utils = trpc.useUtils();
    const [feedbackMessage, setFeedbackMessage] = useState<string | undefined>(undefined);
    const [feedbackTone, setFeedbackTone] = useState<'success' | 'error' | 'info'>('info');

    async function invalidateExecutionEnvironmentQueries() {
        await Promise.all([
            utils.worktree.list.invalidate(),
            utils.session.list.invalidate({ profileId: input.profileId }),
            utils.conversation.listThreads.invalidate({ profileId: input.profileId }),
            invalidateShellBootstrap(utils, input.profileId),
        ]);
    }

    return {
        feedbackMessage,
        feedbackTone,
        clearFeedback: () => {
            setFeedbackMessage(undefined);
            setFeedbackTone('info');
        },
        async resolvePermission(payload: {
            requestId: PermissionRecord['id'];
            resolution: PermissionResolution;
            selectedApprovalResource?: string;
        }) {
            input.onResolvePermission();
            await input.mutations.resolvePermissionMutation.mutateAsync({
                profileId: input.profileId,
                requestId: payload.requestId,
                resolution: payload.resolution,
                ...(payload.selectedApprovalResource
                    ? { selectedApprovalResource: payload.selectedApprovalResource }
                    : {}),
            });
            await utils.permission.listPending.invalidate();
        },
        async configureThreadExecution(payload: {
            threadId: EntityId<'thr'>;
            executionInput: Pick<
                ConversationSetThreadExecutionEnvironmentInput,
                'mode' | 'executionBranch' | 'baseBranch' | 'worktreeId'
            >;
        }) {
            const selectedWorktreeId =
                payload.executionInput.mode === 'worktree' && isEntityId(payload.executionInput.worktreeId, 'wt')
                    ? payload.executionInput.worktreeId
                    : undefined;
            try {
                await input.mutations.configureThreadWorktreeMutation.mutateAsync({
                    profileId: input.profileId,
                    threadId: payload.threadId,
                    mode: payload.executionInput.mode,
                    ...(payload.executionInput.executionBranch
                        ? { executionBranch: payload.executionInput.executionBranch }
                        : {}),
                    ...(payload.executionInput.baseBranch ? { baseBranch: payload.executionInput.baseBranch } : {}),
                    ...(selectedWorktreeId ? { worktreeId: selectedWorktreeId } : {}),
                });
                await invalidateExecutionEnvironmentQueries();
                setFeedbackTone('success');
                setFeedbackMessage('Execution environment updated.');
            } catch (error: unknown) {
                setFeedbackTone('error');
                setFeedbackMessage(error instanceof Error ? error.message : 'Execution environment update failed.');
                throw error;
            }
        },
        async refreshWorktree(worktreeId: `wt_${string}`) {
            try {
                await input.mutations.refreshWorktreeMutation.mutateAsync({
                    profileId: input.profileId,
                    worktreeId,
                });
                await invalidateExecutionEnvironmentQueries();
                setFeedbackTone('success');
                setFeedbackMessage('Managed worktree status refreshed.');
            } catch (error: unknown) {
                setFeedbackTone('error');
                setFeedbackMessage(error instanceof Error ? error.message : 'Managed worktree refresh failed.');
                throw error;
            }
        },
        async removeWorktree(worktreeId: `wt_${string}`) {
            try {
                await input.mutations.removeWorktreeMutation.mutateAsync({
                    profileId: input.profileId,
                    worktreeId,
                    removeFiles: true,
                });
                await invalidateExecutionEnvironmentQueries();
                setFeedbackTone('success');
                setFeedbackMessage('Managed worktree removed.');
            } catch (error: unknown) {
                setFeedbackTone('error');
                setFeedbackMessage(error instanceof Error ? error.message : 'Managed worktree removal failed.');
                throw error;
            }
        },
        async removeOrphanedWorktrees(workspaceFingerprint: string | undefined) {
            try {
                await input.mutations.removeOrphanedWorktreesMutation.mutateAsync({
                    profileId: input.profileId,
                    ...(workspaceFingerprint ? { workspaceFingerprint } : {}),
                });
                await invalidateExecutionEnvironmentQueries();
                setFeedbackTone('success');
                setFeedbackMessage('Removed orphaned managed worktrees.');
            } catch (error: unknown) {
                setFeedbackTone('error');
                setFeedbackMessage(error instanceof Error ? error.message : 'Orphaned worktree cleanup failed.');
                throw error;
            }
        },
    };
}
