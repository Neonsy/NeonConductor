import { useConversationShellQueries } from '@/web/components/conversation/conversationShellQueries';

interface UseConversationShellRefetchInput {
    queries: ReturnType<typeof useConversationShellQueries>;
}

export function useConversationShellRefetch(input: UseConversationShellRefetchInput) {
    return {
        refetchThreadChrome: () =>
            Promise.all([
                input.queries.listBucketsQuery.refetch(),
                input.queries.listThreadsQuery.refetch(),
                input.queries.listTagsQuery.refetch(),
                input.queries.shellBootstrapQuery.refetch(),
            ]),
        refetchSessionIndex: () =>
            Promise.all([input.queries.sessionsQuery.refetch(), input.queries.listThreadsQuery.refetch()]),
        refetchSessionWorkspace: () =>
            Promise.all([
                input.queries.sessionsQuery.refetch(),
                input.queries.runsQuery.refetch(),
                input.queries.messagesQuery.refetch(),
                input.queries.listThreadsQuery.refetch(),
            ]),
        refetchPlanWorkspace: () =>
            Promise.all([
                input.queries.activePlanQuery.refetch(),
                input.queries.orchestratorLatestQuery.refetch(),
                input.queries.runsQuery.refetch(),
            ]),
    };
}
