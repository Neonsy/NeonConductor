import type { ConversationUiState } from '@/web/components/conversation/hooks/useConversationUiState';
import { isEntityId } from '@/web/components/conversation/shellHelpers';
import { trpc } from '@/web/trpc/client';

import type { TopLevelTab } from '@/app/backend/runtime/contracts';

interface UseConversationShellQueriesInput {
    profileId: string;
    uiState: ConversationUiState;
    selectedSessionId: string | undefined;
    selectedRunId: string | undefined;
    topLevelTab: TopLevelTab;
}

export function useConversationShellQueries(input: UseConversationShellQueriesInput) {
    const shellBootstrapQuery = trpc.runtime.getShellBootstrap.useQuery(
        { profileId: input.profileId },
        { refetchOnWindowFocus: false }
    );
    const listBucketsQuery = trpc.conversation.listBuckets.useQuery(
        { profileId: input.profileId },
        { refetchOnWindowFocus: false }
    );
    const listTagsQuery = trpc.conversation.listTags.useQuery(
        { profileId: input.profileId },
        { refetchOnWindowFocus: false }
    );
    const listThreadsQuery = trpc.conversation.listThreads.useQuery(
        {
            profileId: input.profileId,
            activeTab: input.topLevelTab,
            showAllModes: input.uiState.showAllModes,
            groupView: input.uiState.groupView,
            ...(input.uiState.scopeFilter !== 'all' ? { scope: input.uiState.scopeFilter } : {}),
            ...(input.uiState.workspaceFilter ? { workspaceFingerprint: input.uiState.workspaceFilter } : {}),
            ...(input.uiState.sort ? { sort: input.uiState.sort } : {}),
        },
        { refetchOnWindowFocus: false }
    );

    const fallbackSessionId = 'sess_missing';
    const selectedSessionIdForQueries = isEntityId(input.selectedSessionId, 'sess')
        ? input.selectedSessionId
        : fallbackSessionId;
    const selectedRunIdForQueries = isEntityId(input.selectedRunId, 'run') ? input.selectedRunId : undefined;

    const sessionsQuery = trpc.session.list.useQuery(
        { profileId: input.profileId },
        { refetchOnWindowFocus: false }
    );
    const runsQuery = trpc.session.listRuns.useQuery(
        {
            profileId: input.profileId,
            sessionId: selectedSessionIdForQueries,
        },
        {
            enabled: isEntityId(input.selectedSessionId, 'sess'),
            refetchOnWindowFocus: false,
        }
    );
    const messagesQuery = trpc.session.listMessages.useQuery(
        {
            profileId: input.profileId,
            sessionId: selectedSessionIdForQueries,
            ...(selectedRunIdForQueries ? { runId: selectedRunIdForQueries } : {}),
        },
        {
            enabled: isEntityId(input.selectedSessionId, 'sess'),
            refetchOnWindowFocus: false,
        }
    );
    const attachedSkillsQuery = trpc.session.getAttachedSkills.useQuery(
        {
            profileId: input.profileId,
            sessionId: selectedSessionIdForQueries,
        },
        {
            enabled: isEntityId(input.selectedSessionId, 'sess') && input.topLevelTab === 'agent',
            refetchOnWindowFocus: false,
        }
    );
    const usageSummaryQuery = trpc.provider.getUsageSummary.useQuery(
        { profileId: input.profileId },
        { refetchOnWindowFocus: false }
    );
    const pendingPermissionsQuery = trpc.permission.listPending.useQuery(undefined, { refetchOnWindowFocus: false });

    const activePlanQuery = trpc.plan.getActive.useQuery(
        {
            profileId: input.profileId,
            sessionId: selectedSessionIdForQueries,
            topLevelTab: input.topLevelTab,
        },
        {
            enabled:
                Boolean(input.selectedSessionId) &&
                (input.topLevelTab === 'agent' || input.topLevelTab === 'orchestrator'),
            refetchOnWindowFocus: false,
        }
    );

    const orchestratorLatestQuery = trpc.orchestrator.latestBySession.useQuery(
        {
            profileId: input.profileId,
            sessionId: selectedSessionIdForQueries,
        },
        {
            enabled: Boolean(input.selectedSessionId) && input.topLevelTab === 'orchestrator',
            refetchOnWindowFocus: false,
        }
    );

    return {
        shellBootstrapQuery,
        listBucketsQuery,
        listTagsQuery,
        listThreadsQuery,
        sessionsQuery,
        runsQuery,
        messagesQuery,
        attachedSkillsQuery,
        usageSummaryQuery,
        pendingPermissionsQuery,
        activePlanQuery,
        orchestratorLatestQuery,
    };
}
