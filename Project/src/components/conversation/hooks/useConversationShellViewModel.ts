import { useConversationUiState } from '@/web/components/conversation/hooks/useConversationUiState';
import { useSessionRunSelection } from '@/web/components/conversation/hooks/useSessionRunSelection';
import { useThreadSidebarState } from '@/web/components/conversation/hooks/useThreadSidebarState';
import { useConversationQueries } from '@/web/components/conversation/shell/queries/useConversationQueries';
import { isEntityId } from '@/web/components/conversation/shell/workspace/helpers';
import { useConversationRunTarget } from '@/web/components/conversation/shell/workspace/useConversationRunTarget';
import { PROGRESSIVE_QUERY_OPTIONS } from '@/web/lib/query/progressiveQueryOptions';
import { trpc } from '@/web/trpc/client';

import type { TopLevelTab } from '@/app/backend/runtime/contracts';

function buildWorkspaceScope(input: {
    selectedThread: ReturnType<typeof useThreadSidebarState>['visibleThreads'][number] | undefined;
    selectedManagedWorktree:
        | NonNullable<ReturnType<typeof useConversationQueries>['shellBootstrapQuery']['data']>['worktrees'][number]
        | undefined;
    selectedWorkspaceRoot:
        | NonNullable<ReturnType<typeof useConversationQueries>['shellBootstrapQuery']['data']>['workspaceRoots'][number]
        | undefined;
}) {
    const { selectedManagedWorktree, selectedThread, selectedWorkspaceRoot } = input;
    if (!selectedThread?.workspaceFingerprint) {
        return { kind: 'detached' as const };
    }
    if (selectedManagedWorktree) {
        return {
            kind: 'worktree' as const,
            label: selectedManagedWorktree.label,
            absolutePath: selectedManagedWorktree.absolutePath,
            branch: selectedManagedWorktree.branch,
            baseBranch: selectedManagedWorktree.baseBranch,
            baseWorkspaceLabel: selectedWorkspaceRoot?.label ?? selectedThread.workspaceFingerprint,
            baseWorkspacePath: selectedWorkspaceRoot?.absolutePath ?? 'Unresolved workspace root',
            worktreeId: selectedManagedWorktree.id,
        };
    }

    return {
        kind: 'workspace' as const,
        label: selectedWorkspaceRoot?.label ?? selectedThread.workspaceFingerprint,
        absolutePath: selectedWorkspaceRoot?.absolutePath ?? 'Unresolved workspace root',
        executionEnvironmentMode:
            selectedThread.executionEnvironmentMode === 'worktree' ? 'local' : selectedThread.executionEnvironmentMode,
        ...(selectedThread.executionBranch ? { executionBranch: selectedThread.executionBranch } : {}),
        ...(selectedThread.baseBranch ? { baseBranch: selectedThread.baseBranch } : {}),
    };
}

export function useConversationShellViewModel(input: {
    profileId: string;
    topLevelTab: TopLevelTab;
    modeKey: string;
    queries: ReturnType<typeof useConversationQueries>;
    uiState: ReturnType<typeof useConversationUiState>;
    sidebarState: ReturnType<typeof useThreadSidebarState>;
    runTargetState: ReturnType<typeof useConversationRunTarget>;
}) {
    const selectedThread = input.uiState.selectedThreadId
        ? input.sidebarState.visibleThreads.find((thread) => thread.id === input.uiState.selectedThreadId)
        : undefined;
    const selectedWorkspaceRoot = selectedThread?.workspaceFingerprint
        ? input.queries.shellBootstrapQuery.data?.workspaceRoots.find(
              (workspaceRoot) => workspaceRoot.fingerprint === selectedThread.workspaceFingerprint
          )
        : undefined;
    const registryResolvedQuery = trpc.registry.listResolved.useQuery(
        {
            profileId: input.profileId,
            ...(selectedThread?.workspaceFingerprint
                ? { workspaceFingerprint: selectedThread.workspaceFingerprint }
                : {}),
            ...(selectedThread?.worktreeId ? { worktreeId: selectedThread.worktreeId } : {}),
        },
        {
            enabled: input.topLevelTab === 'agent',
            ...PROGRESSIVE_QUERY_OPTIONS,
        }
    );
    const pendingPermissions =
        input.queries.pendingPermissionsQuery.data?.requests.filter((request) => request.profileId === input.profileId) ?? [];
    const permissionWorkspaces = Object.fromEntries(
        (input.queries.shellBootstrapQuery.data?.workspaceRoots ?? []).map((workspaceRoot) => [
            workspaceRoot.fingerprint,
            { label: workspaceRoot.label, absolutePath: workspaceRoot.absolutePath },
        ])
    );
    const visibleManagedWorktrees = selectedThread?.workspaceFingerprint
        ? (input.queries.shellBootstrapQuery.data?.worktrees ?? []).filter(
              (worktree) => worktree.workspaceFingerprint === selectedThread.workspaceFingerprint
          )
        : [];
    const sessionRunSelection = useSessionRunSelection({
        allSessions: input.queries.sessionsQuery.data?.sessions ?? [],
        allRuns: input.queries.runsQuery.data?.runs ?? [],
        allMessages: input.queries.messagesQuery.data?.messages ?? [],
        allMessageParts: input.queries.messagesQuery.data?.messageParts ?? [],
        selectedThreadId: input.uiState.selectedThreadId,
        selectedSessionId: isEntityId(input.uiState.selectedSessionId, 'sess') ? input.uiState.selectedSessionId : undefined,
        selectedRunId: isEntityId(input.uiState.selectedRunId, 'run') ? input.uiState.selectedRunId : undefined,
    });
    const selectedSession = sessionRunSelection.selection.resolvedSessionId
        ? sessionRunSelection.sessions.find((session) => session.id === sessionRunSelection.selection.resolvedSessionId)
        : undefined;
    const selectedManagedWorktree =
        selectedThread?.workspaceFingerprint &&
        (selectedSession?.worktreeId ?? selectedThread.worktreeId)
            ? input.queries.shellBootstrapQuery.data?.worktrees.find(
                  (worktree) => worktree.id === (selectedSession?.worktreeId ?? selectedThread.worktreeId)
              )
            : undefined;
    const selectedThreadWorktreeId = isEntityId(selectedThread?.worktreeId, 'wt') ? selectedThread.worktreeId : undefined;
    const selectedSessionWorktreeId = isEntityId(selectedSession?.worktreeId, 'wt')
        ? selectedSession.worktreeId
        : undefined;
    const effectiveSelectedWorktreeId = selectedSessionWorktreeId ?? selectedThreadWorktreeId;
    const selectedProviderStatus = input.runTargetState.selectedProviderIdForComposer
        ? input.runTargetState.providerById.get(input.runTargetState.selectedProviderIdForComposer)
        : undefined;
    const selectedModelLabel =
        input.runTargetState.selectedProviderIdForComposer && input.runTargetState.selectedModelIdForComposer
            ? input.runTargetState.modelsByProvider
                  .get(input.runTargetState.selectedProviderIdForComposer)
                  ?.find((model) => model.id === input.runTargetState.selectedModelIdForComposer)?.label
            : undefined;
    const selectedUsageSummary = input.queries.usageSummaryQuery.data?.summaries.find(
        (summary) => summary.providerId === input.runTargetState.selectedProviderIdForComposer
    );
    const attachedSkills = input.queries.attachedSkillsQuery.data?.skillfiles ?? [];
    const missingAttachedSkillKeys = input.queries.attachedSkillsQuery.data?.missingAssetKeys ?? [];
    const activeModeLabel =
        input.topLevelTab === 'agent'
            ? registryResolvedQuery.data?.resolved.modes.find(
                  (resolvedMode) => resolvedMode.topLevelTab === 'agent' && resolvedMode.modeKey === input.modeKey
              )?.label ?? input.modeKey
            : undefined;

    return {
        selectedThread,
        registryResolvedQuery,
        pendingPermissions,
        permissionWorkspaces,
        visibleManagedWorktrees,
        sessionRunSelection,
        effectiveSelectedWorktreeId,
        selectedProviderStatus,
        selectedModelLabel,
        selectedUsageSummary,
        attachedSkills,
        missingAttachedSkillKeys,
        activeModeLabel,
        workspaceScope: buildWorkspaceScope({
            selectedThread,
            selectedManagedWorktree,
            selectedWorkspaceRoot,
        }),
    };
}
