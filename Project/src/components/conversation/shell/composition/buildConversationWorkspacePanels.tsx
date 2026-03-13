import { useConversationShellViewModel } from '@/web/components/conversation/hooks/useConversationShellViewModel';
import { AttachedSkillsPanel } from '@/web/components/conversation/panels/attachedSkillsPanel';
import { DiffCheckpointPanel } from '@/web/components/conversation/panels/diffCheckpointPanel';
import { ExecutionEnvironmentPanel } from '@/web/components/conversation/panels/executionEnvironmentPanel';
import { useConversationMutations } from '@/web/components/conversation/shell/actions/useConversationMutations';
import { buildConversationPlanOrchestrator } from '@/web/components/conversation/shell/composition/buildConversationPlanOrchestrator';
import { useConversationQueries } from '@/web/components/conversation/shell/queries/useConversationQueries';
import { isEntityId } from '@/web/components/conversation/shell/workspace/helpers';
import { useConversationWorkspaceActions } from '@/web/components/conversation/shell/workspace/useConversationWorkspaceActions';

import type { TopLevelTab } from '@/shared/contracts';

interface BuildConversationWorkspacePanelsInput {
    profileId: string;
    topLevelTab: TopLevelTab;
    selectedSessionId: string | undefined;
    selectedRunId: string | undefined;
    modeKey: string;
    shellViewModel: ReturnType<typeof useConversationShellViewModel>;
    queries: ReturnType<typeof useConversationQueries>;
    mutations: ReturnType<typeof useConversationMutations>;
    planOrchestrator: ReturnType<typeof buildConversationPlanOrchestrator>;
    workspaceActions: ReturnType<typeof useConversationWorkspaceActions>;
}

export function buildConversationWorkspacePanels(input: BuildConversationWorkspacePanelsInput) {
    return {
        executionEnvironmentPanel: (
            <ExecutionEnvironmentPanel
                topLevelTab={input.topLevelTab}
                selectedThread={input.shellViewModel.selectedThread}
                workspaceScope={input.shellViewModel.workspaceScope}
                worktrees={input.shellViewModel.visibleManagedWorktrees}
                busy={
                    input.mutations.configureThreadWorktreeMutation.isPending ||
                    input.mutations.refreshWorktreeMutation.isPending ||
                    input.mutations.removeWorktreeMutation.isPending ||
                    input.mutations.removeOrphanedWorktreesMutation.isPending
                }
                {...(input.workspaceActions.feedbackMessage
                    ? {
                          feedbackMessage: input.workspaceActions.feedbackMessage,
                          feedbackTone: input.workspaceActions.feedbackTone,
                      }
                    : {})}
                onConfigureThread={(executionInput) => {
                    if (!input.shellViewModel.selectedThread || !isEntityId(input.shellViewModel.selectedThread.id, 'thr')) {
                        return;
                    }
                    if (executionInput.mode === 'worktree') {
                        if (!isEntityId(executionInput.worktreeId, 'wt')) {
                            return;
                        }
                        void input.workspaceActions.configureThreadExecution({
                            threadId: input.shellViewModel.selectedThread.id,
                            executionInput: {
                                mode: executionInput.mode,
                                ...(executionInput.executionBranch
                                    ? { executionBranch: executionInput.executionBranch }
                                    : {}),
                                ...(executionInput.baseBranch ? { baseBranch: executionInput.baseBranch } : {}),
                                worktreeId: executionInput.worktreeId,
                            },
                        });
                        return;
                    }
                    void input.workspaceActions.configureThreadExecution({
                        threadId: input.shellViewModel.selectedThread.id,
                        executionInput: {
                            mode: executionInput.mode,
                            ...(executionInput.executionBranch
                                ? { executionBranch: executionInput.executionBranch }
                                : {}),
                            ...(executionInput.baseBranch ? { baseBranch: executionInput.baseBranch } : {}),
                        },
                    });
                }}
                onRefreshWorktree={(worktreeId) => {
                    if (!isEntityId(worktreeId, 'wt')) {
                        return;
                    }
                    void input.workspaceActions.refreshWorktree(worktreeId);
                }}
                onRemoveWorktree={(worktreeId) => {
                    if (!isEntityId(worktreeId, 'wt')) {
                        return;
                    }
                    void input.workspaceActions.removeWorktree(worktreeId);
                }}
                onRemoveOrphaned={() => {
                    void input.workspaceActions.removeOrphanedWorktrees(
                        input.shellViewModel.selectedThread?.workspaceFingerprint
                    );
                }}
            />
        ),
        attachedSkillsPanel:
            input.topLevelTab === 'agent' && isEntityId(input.selectedSessionId, 'sess') ? (
                <AttachedSkillsPanel
                    profileId={input.profileId}
                    sessionId={input.selectedSessionId}
                    {...(input.shellViewModel.selectedThread?.workspaceFingerprint
                        ? { workspaceFingerprint: input.shellViewModel.selectedThread.workspaceFingerprint }
                        : {})}
                    {...(input.shellViewModel.effectiveSelectedWorktreeId
                        ? { worktreeId: input.shellViewModel.effectiveSelectedWorktreeId }
                        : {})}
                    attachedSkills={input.shellViewModel.attachedSkills}
                    missingAssetKeys={input.shellViewModel.missingAttachedSkillKeys}
                />
            ) : undefined,
        diffCheckpointPanel:
            input.topLevelTab !== 'chat' ? (
                <DiffCheckpointPanel
                    profileId={input.profileId}
                    {...(isEntityId(input.selectedRunId, 'run') ? { selectedRunId: input.selectedRunId } : {})}
                    {...(isEntityId(input.selectedSessionId, 'sess')
                        ? { selectedSessionId: input.selectedSessionId }
                        : {})}
                    diffs={input.queries.runDiffsQuery.data?.diffs ?? []}
                    checkpoints={input.queries.checkpointsQuery.data?.checkpoints ?? []}
                    disabled={input.mutations.startRunMutation.isPending || input.mutations.planStartMutation.isPending}
                />
            ) : undefined,
    };
}

