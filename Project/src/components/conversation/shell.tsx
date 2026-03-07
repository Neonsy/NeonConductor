import { useEffectEvent, useState } from 'react';

import { useConversationShellMutations } from '@/web/components/conversation/conversationShellMutations';
import { buildConversationShellPlanOrchestrator } from '@/web/components/conversation/conversationShellPlanOrchestrator';
import { useConversationShellQueries } from '@/web/components/conversation/conversationShellQueries';
import { useConversationShellRefetch } from '@/web/components/conversation/conversationShellRefetch';
import { useConversationShellRunTarget } from '@/web/components/conversation/conversationShellRunTarget';
import { ConversationShellSidebarPane } from '@/web/components/conversation/conversationShellSidebarPane';
import { useConversationShellSync } from '@/web/components/conversation/conversationShellSync';
import { ConversationShellWorkspaceSection } from '@/web/components/conversation/conversationShellWorkspaceSection';
import { useConversationShellComposer } from '@/web/components/conversation/hooks/useConversationShellComposer';
import { useConversationShellEditFlow } from '@/web/components/conversation/hooks/useConversationShellEditFlow';
import { useConversationShellRoutingBadge } from '@/web/components/conversation/hooks/useConversationShellRoutingBadge';
import { useConversationShellSessionActions } from '@/web/components/conversation/hooks/useConversationShellSessionActions';
import { useConversationUiState } from '@/web/components/conversation/hooks/useConversationUiState';
import { useSessionRunSelection } from '@/web/components/conversation/hooks/useSessionRunSelection';
import { useThreadSidebarState } from '@/web/components/conversation/hooks/useThreadSidebarState';
import { MessageEditDialog } from '@/web/components/conversation/panels/messageEditDialog';
import { ModeExecutionPanel } from '@/web/components/conversation/panels/modeExecutionPanel';
import { DEFAULT_RUN_OPTIONS, isProviderId } from '@/web/components/conversation/shellHelpers';
import { useRuntimeEventStreamStore } from '@/web/lib/runtime/eventStream';

import type { TopLevelTab } from '@/app/backend/runtime/contracts';

interface ConversationShellProps {
    profileId: string;
    topLevelTab: TopLevelTab;
    modeKey: string;
    onTopLevelTabChange: (nextTab: TopLevelTab) => void;
}

export function ConversationShell({ profileId, topLevelTab, modeKey, onTopLevelTabChange }: ConversationShellProps) {
    const [tabSwitchNotice, setTabSwitchNotice] = useState<string | undefined>(undefined);
    const uiState = useConversationUiState(profileId);

    const queries = useConversationShellQueries({
        profileId,
        uiState,
        selectedSessionId: uiState.selectedSessionId,
        selectedRunId: uiState.selectedRunId,
        topLevelTab,
    });
    const mutations = useConversationShellMutations();
    const refetch = useConversationShellRefetch({ queries });
    const resetForProfile = useEffectEvent(() => {
        setTabSwitchNotice(undefined);
        composer.resetComposer();
        sessionActions.resetSessionActions();
        editFlow.resetEditFlow();
    });

    useConversationShellSync({
        profileId,
        uiState,
        threads: queries.listThreadsQuery.data,
        tags: queries.listTagsQuery.data?.tags,
        buckets: queries.listBucketsQuery.data?.buckets,
        onProfileReset: resetForProfile,
    });

    const streamState = useRuntimeEventStreamStore((state) => state.connectionState);
    const selectedSessionId = uiState.selectedSessionId;
    const selectedRunId = uiState.selectedRunId;
    const sessionActions = useConversationShellSessionActions({
        profileId,
        selectedThreadId: uiState.selectedThreadId,
        selectedSessionId,
        createSession: mutations.createSessionMutation.mutateAsync,
        onClearError: () => {
            composer.clearRunSubmitError();
        },
        onError: (message) => {
            composer.setRunSubmitError(message);
        },
        onSelectSessionId: uiState.setSelectedSessionId,
        onSelectRunId: uiState.setSelectedRunId,
        refetchSessionIndex: () => {
            void refetch.refetchSessionIndex();
        },
    });

    const sidebarState = useThreadSidebarState({
        threads: queries.listThreadsQuery.data?.threads ?? [],
        threadTags: queries.shellBootstrapQuery.data?.threadTags ?? [],
        selectedTagId: uiState.selectedTagId,
        selectedThreadId: uiState.selectedThreadId,
        onSelectedThreadInvalid: () => {
            uiState.setSelectedThreadId(undefined);
        },
        onSelectFallbackThread: (threadId) => {
            uiState.setSelectedThreadId(threadId);
        },
    });

    const selectedThread = uiState.selectedThreadId
        ? sidebarState.visibleThreads.find((thread) => thread.id === uiState.selectedThreadId)
        : undefined;

    const sessionRunSelection = useSessionRunSelection({
        allSessions: queries.sessionsQuery.data?.sessions ?? [],
        allRuns: queries.runsQuery.data?.runs ?? [],
        allMessages: queries.messagesQuery.data?.messages ?? [],
        allMessageParts: queries.messagesQuery.data?.messageParts ?? [],
        selectedThreadId: uiState.selectedThreadId,
        selectedSessionId: uiState.selectedSessionId,
        selectedRunId: uiState.selectedRunId,
        onSelectedSessionInvalid: () => {
            uiState.setSelectedSessionId(undefined);
        },
        onSelectFallbackSession: (sessionId) => {
            uiState.setSelectedSessionId(sessionId);
        },
        onSelectedRunInvalid: () => {
            uiState.setSelectedRunId(undefined);
        },
        onSelectFallbackRun: (runId) => {
            uiState.setSelectedRunId(runId);
        },
    });

    const runTargetState = useConversationShellRunTarget({
        providers: queries.shellBootstrapQuery.data?.providers ?? [],
        providerModels: queries.shellBootstrapQuery.data?.providerModels ?? [],
        defaults: queries.shellBootstrapQuery.data?.defaults,
        runs: sessionRunSelection.runs,
        ...(sessionActions.sessionOverride ? { sessionOverride: sessionActions.sessionOverride } : {}),
    });
    const composer = useConversationShellComposer({
        profileId,
        selectedSessionId,
        isPlanningMode: modeKey === 'plan' && (topLevelTab === 'agent' || topLevelTab === 'orchestrator'),
        topLevelTab,
        modeKey,
        workspaceFingerprint: selectedThread?.workspaceFingerprint,
        resolvedRunTarget: runTargetState.resolvedRunTarget,
        providerById: runTargetState.providerById,
        runtimeOptions: DEFAULT_RUN_OPTIONS,
        isStartingRun: mutations.startRunMutation.isPending,
        startPlan: mutations.planStartMutation.mutateAsync,
        startRun: mutations.startRunMutation.mutateAsync,
        refetchActivePlan: () => {
            void queries.activePlanQuery.refetch();
        },
        refetchSessionWorkspace: () => {
            void refetch.refetchSessionWorkspace();
        },
    });
    const routingBadge = useConversationShellRoutingBadge({
        profileId,
        providerId: runTargetState.selectedProviderIdForComposer,
        modelId: runTargetState.selectedModelIdForComposer,
    });
    const selectedProviderStatus = runTargetState.selectedProviderIdForComposer
        ? runTargetState.providerById.get(runTargetState.selectedProviderIdForComposer)
        : undefined;
    const selectedModelLabel =
        runTargetState.selectedProviderIdForComposer && runTargetState.selectedModelIdForComposer
            ? runTargetState.modelsByProvider
                  .get(runTargetState.selectedProviderIdForComposer)
                  ?.find((model) => model.id === runTargetState.selectedModelIdForComposer)?.label
            : undefined;
    const selectedUsageSummary = queries.usageSummaryQuery.data?.summaries.find(
        (summary) => summary.providerId === runTargetState.selectedProviderIdForComposer
    );
    const editFlow = useConversationShellEditFlow({
        profileId,
        topLevelTab,
        modeKey,
        selectedSessionId,
        selectedThread,
        resolvedRunTarget: runTargetState.resolvedRunTarget,
        editSession: mutations.editSessionMutation.mutateAsync,
        setEditPreference: mutations.setEditPreferenceMutation.mutateAsync,
        uiState,
        onTopLevelTabChange,
        onClearError: composer.clearRunSubmitError,
        onError: composer.setRunSubmitError,
        onPromptReset: () => {
            composer.resetComposer();
        },
        refetchSessionWorkspace: () => {
            void refetch.refetchSessionWorkspace();
        },
    });

    const planOrchestrator = buildConversationShellPlanOrchestrator({
        profileId,
        activePlanRefetch: queries.activePlanQuery.refetch,
        orchestratorLatestRefetch: queries.orchestratorLatestQuery.refetch,
        sessionRunsRefetch: queries.runsQuery.refetch,
        onError: composer.setRunSubmitError,
        resolvedRunTarget: runTargetState.resolvedRunTarget,
        workspaceFingerprint: selectedThread?.workspaceFingerprint,
        activePlan: queries.activePlanQuery.data?.found ? queries.activePlanQuery.data.plan : undefined,
        orchestratorView: queries.orchestratorLatestQuery.data?.found
            ? queries.orchestratorLatestQuery.data
            : undefined,
        planStartMutation: mutations.planStartMutation,
        planAnswerMutation: mutations.planAnswerMutation,
        planReviseMutation: mutations.planReviseMutation,
        planApproveMutation: mutations.planApproveMutation,
        planImplementMutation: mutations.planImplementMutation,
        orchestratorAbortMutation: mutations.orchestratorAbortMutation,
    });

    return (
        <main className='bg-background flex min-h-0 flex-1 overflow-hidden'>
            <ConversationShellSidebarPane
                profileId={profileId}
                topLevelTab={topLevelTab}
                buckets={queries.listBucketsQuery.data?.buckets ?? []}
                threads={sidebarState.visibleThreads}
                tags={queries.listTagsQuery.data?.tags ?? []}
                threadTagIdsByThread={sidebarState.threadTagIdsByThread}
                selectedThreadId={uiState.selectedThreadId}
                selectedTagId={uiState.selectedTagId}
                scopeFilter={uiState.scopeFilter}
                workspaceFilter={uiState.workspaceFilter}
                sort={uiState.sort ?? 'latest'}
                showAllModes={uiState.showAllModes}
                groupView={uiState.groupView}
                isCreatingThread={mutations.createThreadMutation.isPending}
                isAddingTag={mutations.upsertTagMutation.isPending || mutations.setThreadTagsMutation.isPending}
                onTopLevelTabChange={onTopLevelTabChange}
                onSetTabSwitchNotice={setTabSwitchNotice}
                onSelectThreadId={uiState.setSelectedThreadId}
                onSelectSessionId={uiState.setSelectedSessionId}
                onSelectRunId={uiState.setSelectedRunId}
                onSelectTagId={uiState.setSelectedTagId}
                onScopeFilterChange={uiState.setScopeFilter}
                onWorkspaceFilterChange={uiState.setWorkspaceFilter}
                onSortChange={uiState.setSort}
                onShowAllModesChange={uiState.setShowAllModes}
                onGroupViewChange={uiState.setGroupView}
                createThread={mutations.createThreadMutation.mutateAsync}
                upsertTag={mutations.upsertTagMutation.mutateAsync}
                setThreadTags={mutations.setThreadTagsMutation.mutateAsync}
                refetchBuckets={queries.listBucketsQuery.refetch}
                refetchThreads={queries.listThreadsQuery.refetch}
                refetchTags={queries.listTagsQuery.refetch}
                refetchShellBootstrap={queries.shellBootstrapQuery.refetch}
            />

            <ConversationShellWorkspaceSection
                selectedThread={selectedThread}
                selectedSessionId={selectedSessionId}
                selectedRunId={selectedRunId}
                streamState={streamState}
                lastSequence={queries.shellBootstrapQuery.data?.lastSequence ?? 0}
                tabSwitchNotice={tabSwitchNotice}
                sessions={sessionRunSelection.sessions}
                runs={sessionRunSelection.runs}
                messages={sessionRunSelection.messages}
                partsByMessageId={sessionRunSelection.partsByMessageId}
                prompt={composer.prompt}
                isCreatingSession={mutations.createSessionMutation.isPending}
                isStartingRun={mutations.startRunMutation.isPending || mutations.planStartMutation.isPending}
                canCreateSession={Boolean(uiState.selectedThreadId)}
                selectedProviderId={runTargetState.selectedProviderIdForComposer}
                selectedModelId={runTargetState.selectedModelIdForComposer}
                routingBadge={routingBadge}
                {...(selectedProviderStatus
                    ? {
                          selectedProviderStatus: {
                              label: selectedProviderStatus.label,
                              authState: selectedProviderStatus.authState,
                              authMethod: selectedProviderStatus.authMethod,
                          },
                      }
                    : {})}
                {...(selectedModelLabel ? { selectedModelLabel } : {})}
                {...(selectedUsageSummary ? { selectedUsageSummary } : {})}
                providerOptions={runTargetState.providerOptions}
                modelOptions={runTargetState.modelOptions}
                runErrorMessage={composer.runSubmitError}
                onSelectSession={sessionActions.onSelectSession}
                onSelectRun={uiState.setSelectedRunId}
                onProviderChange={(providerId) => {
                    if (!isProviderId(providerId)) {
                        return;
                    }

                    sessionActions.onProviderChange(
                        providerId,
                        runTargetState.modelsByProvider.get(providerId)?.at(0)?.id
                    );
                }}
                onModelChange={(modelId) => {
                    sessionActions.onModelChange(runTargetState.selectedProviderIdForComposer, modelId);
                }}
                onCreateSession={sessionActions.onCreateSession}
                onPromptChange={composer.onPromptChange}
                onSubmitPrompt={composer.onSubmitPrompt}
                onEditMessage={editFlow.onEditMessage}
                onBranchFromMessage={editFlow.onBranchFromMessage}
                modePanel={
                    <ModeExecutionPanel
                        topLevelTab={topLevelTab}
                        modeKey={modeKey}
                        isLoadingPlan={queries.activePlanQuery.isLoading}
                        isPlanMutating={planOrchestrator.isPlanMutating}
                        isOrchestratorMutating={planOrchestrator.isOrchestratorMutating}
                        onAnswerQuestion={planOrchestrator.onAnswerQuestion}
                        onRevisePlan={planOrchestrator.onRevisePlan}
                        onApprovePlan={planOrchestrator.onApprovePlan}
                        onImplementPlan={planOrchestrator.onImplementPlan}
                        onAbortOrchestrator={planOrchestrator.onAbortOrchestrator}
                        {...(planOrchestrator.activePlan ? { activePlan: planOrchestrator.activePlan } : {})}
                        {...(planOrchestrator.orchestratorView
                            ? { orchestratorView: planOrchestrator.orchestratorView }
                            : {})}
                    />
                }
            />

            <MessageEditDialog
                {...editFlow.dialogProps}
                busy={mutations.editSessionMutation.isPending || mutations.setEditPreferenceMutation.isPending}
            />
        </main>
    );
}
