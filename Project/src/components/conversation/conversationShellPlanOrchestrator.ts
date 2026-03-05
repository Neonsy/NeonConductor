import type { ModeExecutionPanelProps } from '@/web/components/conversation/panels/modeExecutionPanel';
import { DEFAULT_RUN_OPTIONS, type RunTargetSelection } from '@/web/components/conversation/shellHelpers';

import type { EntityId, RuntimeProviderId } from '@/app/backend/runtime/contracts';

interface MutationLike<TInput> {
    isPending: boolean;
    mutateAsync: (input: TInput) => Promise<unknown>;
}

interface BuildConversationShellPlanOrchestratorInput {
    profileId: string;
    runtimeSnapshotRefetch: () => Promise<unknown>;
    activePlanRefetch: () => Promise<unknown>;
    orchestratorLatestRefetch: () => Promise<unknown>;
    onError: (message: string) => void;
    resolvedRunTarget: RunTargetSelection | undefined;
    workspaceFingerprint: string | undefined;
    activePlan: ModeExecutionPanelProps['activePlan'];
    orchestratorView: ModeExecutionPanelProps['orchestratorView'];
    planStartMutation: MutationLike<{
        profileId: string;
        sessionId: EntityId<'sess'>;
        topLevelTab: 'chat' | 'agent' | 'orchestrator';
        modeKey: string;
        prompt: string;
        workspaceFingerprint?: string;
    }>;
    planAnswerMutation: MutationLike<{
        profileId: string;
        planId: EntityId<'plan'>;
        questionId: string;
        answer: string;
    }>;
    planReviseMutation: MutationLike<{
        profileId: string;
        planId: EntityId<'plan'>;
        summaryMarkdown: string;
        items: Array<{ description: string }>;
    }>;
    planApproveMutation: MutationLike<{
        profileId: string;
        planId: EntityId<'plan'>;
    }>;
    planImplementMutation: MutationLike<{
        profileId: string;
        planId: EntityId<'plan'>;
        runtimeOptions: typeof DEFAULT_RUN_OPTIONS;
        providerId?: RuntimeProviderId;
        modelId?: string;
        workspaceFingerprint?: string;
    }>;
    orchestratorAbortMutation: MutationLike<{
        profileId: string;
        orchestratorRunId: EntityId<'orch'>;
    }>;
}

export function buildConversationShellPlanOrchestrator(input: BuildConversationShellPlanOrchestratorInput): {
    isPlanMutating: boolean;
    isOrchestratorMutating: boolean;
    activePlan: ModeExecutionPanelProps['activePlan'];
    orchestratorView: ModeExecutionPanelProps['orchestratorView'];
    onAnswerQuestion: ModeExecutionPanelProps['onAnswerQuestion'];
    onRevisePlan: ModeExecutionPanelProps['onRevisePlan'];
    onApprovePlan: ModeExecutionPanelProps['onApprovePlan'];
    onImplementPlan: ModeExecutionPanelProps['onImplementPlan'];
    onAbortOrchestrator: ModeExecutionPanelProps['onAbortOrchestrator'];
} {
    return {
        isPlanMutating:
            input.planStartMutation.isPending ||
            input.planAnswerMutation.isPending ||
            input.planReviseMutation.isPending ||
            input.planApproveMutation.isPending ||
            input.planImplementMutation.isPending,
        isOrchestratorMutating: input.orchestratorAbortMutation.isPending,
        activePlan: input.activePlan,
        orchestratorView: input.orchestratorView,
        onAnswerQuestion: (planId, questionId, answer) => {
            void input.planAnswerMutation
                .mutateAsync({
                    profileId: input.profileId,
                    planId,
                    questionId,
                    answer,
                })
                .then(() => {
                    void input.activePlanRefetch();
                });
        },
        onRevisePlan: (planId, summaryMarkdown, items) => {
            void input.planReviseMutation
                .mutateAsync({
                    profileId: input.profileId,
                    planId,
                    summaryMarkdown,
                    items: items.map((description) => ({ description })),
                })
                .then(() => {
                    void input.activePlanRefetch();
                });
        },
        onApprovePlan: (planId) => {
            void input.planApproveMutation
                .mutateAsync({
                    profileId: input.profileId,
                    planId,
                })
                .then(() => {
                    void input.activePlanRefetch();
                })
                .catch((error: unknown) => {
                    const message = error instanceof Error ? error.message : String(error);
                    input.onError(`Plan approval failed: ${message}`);
                });
        },
        onImplementPlan: (planId) => {
            void input.planImplementMutation
                .mutateAsync({
                    profileId: input.profileId,
                    planId,
                    runtimeOptions: DEFAULT_RUN_OPTIONS,
                    ...(input.resolvedRunTarget ? { providerId: input.resolvedRunTarget.providerId } : {}),
                    ...(input.resolvedRunTarget ? { modelId: input.resolvedRunTarget.modelId } : {}),
                    ...(input.workspaceFingerprint ? { workspaceFingerprint: input.workspaceFingerprint } : {}),
                })
                .then(() => {
                    void input.activePlanRefetch();
                    void input.orchestratorLatestRefetch();
                    void input.runtimeSnapshotRefetch();
                })
                .catch((error: unknown) => {
                    const message = error instanceof Error ? error.message : String(error);
                    input.onError(`Plan implementation failed: ${message}`);
                });
        },
        onAbortOrchestrator: (orchestratorRunId) => {
            void input.orchestratorAbortMutation
                .mutateAsync({
                    profileId: input.profileId,
                    orchestratorRunId,
                })
                .then(() => {
                    void input.orchestratorLatestRefetch();
                });
        },
    };
}
