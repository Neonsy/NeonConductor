import { trpc } from '@/web/trpc/client';

export function useConversationShellMutations() {
    return {
        createThreadMutation: trpc.conversation.createThread.useMutation(),
        upsertTagMutation: trpc.conversation.upsertTag.useMutation(),
        setThreadTagsMutation: trpc.conversation.setThreadTags.useMutation(),
        createSessionMutation: trpc.session.create.useMutation(),
        startRunMutation: trpc.session.startRun.useMutation(),
        planStartMutation: trpc.plan.start.useMutation(),
        planAnswerMutation: trpc.plan.answerQuestion.useMutation(),
        planReviseMutation: trpc.plan.revise.useMutation(),
        planApproveMutation: trpc.plan.approve.useMutation(),
        planImplementMutation: trpc.plan.implement.useMutation(),
        orchestratorAbortMutation: trpc.orchestrator.abort.useMutation(),
    };
}
