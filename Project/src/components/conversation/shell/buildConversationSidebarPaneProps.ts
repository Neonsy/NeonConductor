import {
    getProviderControlDefaults,
    listProviderControlModels,
    listProviderControlProviders,
} from '@/web/lib/providerControl/selectors';

import type { ShellSidebarCompositionInput } from '@/web/components/conversation/shell/useConversationShellViewControllers.types';

export function buildConversationSidebarPaneProps(
    input: ShellSidebarCompositionInput & {
        sidebarStatusMessage: string | undefined;
        sidebarStatusTone: 'error' | 'info' | undefined;
    }
) {
    const providerControl = input.queries.shellBootstrapQuery.data?.providerControl;

    return {
        profileId: input.profileId,
        topLevelTab: input.topLevelTab,
        threadListQueryInput: input.queries.listThreadsInput,
        isCollapsed: input.isSidebarCollapsed,
        onToggleCollapsed: input.onToggleSidebarCollapsed,
        workspaceRoots: input.queries.shellBootstrapQuery.data?.workspaceRoots ?? [],
        providers: listProviderControlProviders(providerControl),
        providerModels: listProviderControlModels(providerControl),
        workspacePreferences: input.queries.shellBootstrapQuery.data?.workspacePreferences ?? [],
        defaults: getProviderControlDefaults(providerControl),
        ...(input.selectedWorkspaceFingerprint
            ? { preferredWorkspaceFingerprint: input.selectedWorkspaceFingerprint }
            : {}),
        buckets: input.queries.listBucketsQuery.data?.buckets ?? [],
        threads: input.selectionState.visibleThreads,
        sessions: input.queries.sessionsQuery.data?.sessions ?? [],
        tags: input.queries.listTagsQuery.data?.tags ?? [],
        threadTags: input.queries.shellBootstrapQuery.data?.threadTags ?? [],
        threadTagIdsByThread: input.selectionState.threadTagIdsByThread,
        selectedThreadId: input.selectionState.selectedThread?.id,
        selectedSessionId: input.selectedSessionId,
        selectedRunId: input.selectedRunId,
        selectedTagIds: input.uiState.selectedTagIds,
        scopeFilter: input.uiState.scopeFilter,
        workspaceFilter: input.uiState.workspaceFilter,
        sort: input.uiState.sort ?? 'latest',
        showAllModes: input.uiState.showAllModes,
        groupView: input.uiState.groupView,
        isAddingTag: input.mutations.upsertTagMutation.isPending || input.mutations.setThreadTagsMutation.isPending,
        isDeletingWorkspaceThreads: input.mutations.deleteWorkspaceThreadsMutation.isPending,
        isCreatingThread: input.mutations.createThreadMutation.isPending || input.mutations.createSessionMutation.isPending,
        ...(input.sidebarStatusMessage ? { statusMessage: input.sidebarStatusMessage } : {}),
        ...(input.sidebarStatusTone ? { statusTone: input.sidebarStatusTone } : {}),
        onTopLevelTabChange: input.onTopLevelTabChange,
        onSetTabSwitchNotice: input.setTabSwitchNotice,
        onSelectThreadId: input.uiState.setSelectedThreadId,
        onSelectSessionId: input.uiState.setSelectedSessionId,
        onSelectRunId: input.uiState.setSelectedRunId,
        onSelectTagIds: input.uiState.setSelectedTagIds,
        onScopeFilterChange: input.uiState.setScopeFilter,
        onWorkspaceFilterChange: input.uiState.setWorkspaceFilter,
        onSortChange: input.uiState.setSort,
        onShowAllModesChange: input.uiState.setShowAllModes,
        onGroupViewChange: input.uiState.setGroupView,
        onCreateThread: input.handleCreateThread,
        onSelectWorkspaceFingerprint: (workspaceFingerprint: string | undefined) => {
            input.onSelectedWorkspaceFingerprintChange?.(workspaceFingerprint);
            input.uiState.setSelectedThreadId(undefined);
            input.uiState.setSelectedSessionId(undefined);
            input.uiState.setSelectedRunId(undefined);
        },
        upsertTag: input.mutations.upsertTagMutation.mutateAsync,
        setThreadTags: input.mutations.setThreadTagsMutation.mutateAsync,
        setThreadFavorite: input.mutations.setThreadFavoriteMutation.mutateAsync,
        deleteWorkspaceThreads: input.mutations.deleteWorkspaceThreadsMutation.mutateAsync,
    };
}
