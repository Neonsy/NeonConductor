import { useEffectEvent, useState } from 'react';

import { useConversationShellMutations } from '@/web/components/conversation/conversationShellMutations';
import { buildConversationShellPlanOrchestrator } from '@/web/components/conversation/conversationShellPlanOrchestrator';
import { useConversationShellQueries } from '@/web/components/conversation/conversationShellQueries';
import { useConversationShellRunTarget } from '@/web/components/conversation/conversationShellRunTarget';
import { ConversationShellSidebarPane } from '@/web/components/conversation/conversationShellSidebarPane';
import { useConversationShellSync } from '@/web/components/conversation/conversationShellSync';
import { ConversationShellWorkspaceSection } from '@/web/components/conversation/conversationShellWorkspaceSection';
import { useConversationUiState } from '@/web/components/conversation/hooks/useConversationUiState';
import { useSessionRunSelection } from '@/web/components/conversation/hooks/useSessionRunSelection';
import { useThreadSidebarState } from '@/web/components/conversation/hooks/useThreadSidebarState';
import type { MessageTimelineEntry } from '@/web/components/conversation/messageTimelineModel';
import { MessageEditDialog } from '@/web/components/conversation/panels/messageEditDialog';
import { ModeExecutionPanel } from '@/web/components/conversation/panels/modeExecutionPanel';
import { toEditFailureMessage, type PendingMessageEdit } from '@/web/components/conversation/shellEditFlow';
import { DEFAULT_RUN_OPTIONS, isEntityId, isProviderId } from '@/web/components/conversation/shellHelpers';
import { submitPrompt as submitPromptFromComposer } from '@/web/components/conversation/shellPromptSubmit';
import { useRuntimeEventStreamStore } from '@/web/lib/runtime/eventStream';
import { trpc } from '@/web/trpc/client';

import type { RuntimeProviderId, TopLevelTab } from '@/app/backend/runtime/contracts';

interface ConversationShellProps {
    profileId: string;
    topLevelTab: TopLevelTab;
    modeKey: string;
    onTopLevelTabChange: (nextTab: TopLevelTab) => void;
}

export function ConversationShell({ profileId, topLevelTab, modeKey, onTopLevelTabChange }: ConversationShellProps) {
    const [prompt, setPrompt] = useState('');
    const [runSubmitError, setRunSubmitError] = useState<string | undefined>(undefined);
    const [tabSwitchNotice, setTabSwitchNotice] = useState<string | undefined>(undefined);
    const [pendingMessageEdit, setPendingMessageEdit] = useState<PendingMessageEdit | undefined>(undefined);
    const [sessionTargetBySessionId, setSessionTargetBySessionId] = useState<
        Record<string, { providerId?: RuntimeProviderId; modelId?: string }>
    >({});
    const uiState = useConversationUiState(profileId);

    const queries = useConversationShellQueries({
        profileId,
        uiState,
        selectedSessionId: uiState.selectedSessionId,
        selectedRunId: uiState.selectedRunId,
        topLevelTab,
    });
    const mutations = useConversationShellMutations();
    const resetForProfile = useEffectEvent(() => {
        setPrompt('');
        setRunSubmitError(undefined);
        setTabSwitchNotice(undefined);
        setSessionTargetBySessionId({});
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

    const selectedSessionId = uiState.selectedSessionId;
    const selectedRunId = uiState.selectedRunId;
    const sessionOverride = selectedSessionId ? sessionTargetBySessionId[selectedSessionId] : undefined;
    const runTargetState = useConversationShellRunTarget({
        providers: queries.shellBootstrapQuery.data?.providers ?? [],
        providerModels: queries.shellBootstrapQuery.data?.providerModels ?? [],
        defaults: queries.shellBootstrapQuery.data?.defaults,
        runs: sessionRunSelection.runs,
        ...(sessionOverride ? { sessionOverride } : {}),
    });
    const isPlanningMode = modeKey === 'plan' && (topLevelTab === 'agent' || topLevelTab === 'orchestrator');
    const kiloRoutingPreferenceQuery = trpc.provider.getModelRoutingPreference.useQuery(
        {
            profileId,
            providerId: 'kilo',
            modelId: runTargetState.selectedModelIdForComposer ?? '',
        },
        {
            enabled:
                runTargetState.selectedProviderIdForComposer === 'kilo' &&
                Boolean(runTargetState.selectedModelIdForComposer),
            refetchOnWindowFocus: false,
        }
    );
    const editPreferenceQuery = trpc.conversation.getEditPreference.useQuery(
        {
            profileId,
        },
        {
            refetchOnWindowFocus: false,
        }
    );
    const editPreference: 'ask' | 'truncate' | 'branch' =
        editPreferenceQuery.data?.value === 'truncate' || editPreferenceQuery.data?.value === 'branch'
            ? editPreferenceQuery.data.value
            : 'ask';
    const routingBadge =
        runTargetState.selectedProviderIdForComposer !== 'kilo'
            ? undefined
            : kiloRoutingPreferenceQuery.data?.preference.routingMode === 'pinned'
              ? `Routing: Pinned (${kiloRoutingPreferenceQuery.data.preference.pinnedProviderId ?? 'unknown'})`
              : `Routing: Dynamic (${
                    kiloRoutingPreferenceQuery.data?.preference.sort === 'price'
                        ? 'Lowest Price'
                        : kiloRoutingPreferenceQuery.data?.preference.sort === 'throughput'
                          ? 'Highest Throughput'
                          : kiloRoutingPreferenceQuery.data?.preference.sort === 'latency'
                            ? 'Lowest Latency'
                            : 'Default'
                })`;

    const planOrchestrator = buildConversationShellPlanOrchestrator({
        profileId,
        activePlanRefetch: queries.activePlanQuery.refetch,
        orchestratorLatestRefetch: queries.orchestratorLatestQuery.refetch,
        sessionRunsRefetch: queries.runsQuery.refetch,
        onError: setRunSubmitError,
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
                prompt={prompt}
                isCreatingSession={mutations.createSessionMutation.isPending}
                isStartingRun={mutations.startRunMutation.isPending || mutations.planStartMutation.isPending}
                canCreateSession={Boolean(uiState.selectedThreadId)}
                selectedProviderId={runTargetState.selectedProviderIdForComposer}
                selectedModelId={runTargetState.selectedModelIdForComposer}
                routingBadge={routingBadge}
                providerOptions={runTargetState.providerOptions}
                modelOptions={runTargetState.modelOptions}
                runErrorMessage={runSubmitError}
                onSelectSession={(sessionId) => {
                    setRunSubmitError(undefined);
                    uiState.setSelectedSessionId(sessionId);
                }}
                onSelectRun={uiState.setSelectedRunId}
                onProviderChange={(providerId) => {
                    if (!selectedSessionId || !isProviderId(providerId)) {
                        return;
                    }

                    const firstModelId = runTargetState.modelsByProvider.get(providerId)?.at(0)?.id;
                    setSessionTargetBySessionId((current) => ({
                        ...current,
                        [selectedSessionId]: {
                            providerId,
                            ...(firstModelId ? { modelId: firstModelId } : {}),
                        },
                    }));
                    setRunSubmitError(undefined);
                }}
                onModelChange={(modelId) => {
                    const providerId = runTargetState.selectedProviderIdForComposer;
                    if (!selectedSessionId || !providerId || modelId.trim().length === 0) {
                        return;
                    }

                    setSessionTargetBySessionId((current) => ({
                        ...current,
                        [selectedSessionId]: {
                            providerId,
                            modelId,
                        },
                    }));
                    setRunSubmitError(undefined);
                }}
                onCreateSession={() => {
                    if (!isEntityId(uiState.selectedThreadId, 'thr')) {
                        return;
                    }

                    void mutations.createSessionMutation
                        .mutateAsync({
                            profileId,
                            threadId: uiState.selectedThreadId,
                            kind: 'local',
                        })
                        .then((result) => {
                            if (!result.created) {
                                setRunSubmitError('Selected thread no longer exists.');
                                return;
                            }
                            uiState.setSelectedSessionId(result.session.id);
                            uiState.setSelectedRunId(undefined);
                            setRunSubmitError(undefined);
                            void Promise.all([queries.sessionsQuery.refetch(), queries.listThreadsQuery.refetch()]);
                        });
                }}
                onPromptChange={(nextPrompt) => {
                    setRunSubmitError(undefined);
                    setPrompt(nextPrompt);
                }}
                onSubmitPrompt={() => {
                    void submitPromptFromComposer({
                        prompt,
                        isStartingRun: mutations.startRunMutation.isPending,
                        selectedSessionId,
                        isPlanningMode,
                        profileId,
                        topLevelTab,
                        modeKey,
                        workspaceFingerprint: selectedThread?.workspaceFingerprint,
                        resolvedRunTarget: runTargetState.resolvedRunTarget,
                        runtimeOptions: DEFAULT_RUN_OPTIONS,
                        providerById: runTargetState.providerById,
                        startPlan: mutations.planStartMutation.mutateAsync,
                        startRun: mutations.startRunMutation.mutateAsync,
                        onPromptCleared: () => {
                            setRunSubmitError(undefined);
                            setPrompt('');
                        },
                        onPlanRefetch: () => {
                            void queries.activePlanQuery.refetch();
                        },
                        onRuntimeRefetch: () => {
                            void Promise.all([
                                queries.sessionsQuery.refetch(),
                                queries.runsQuery.refetch(),
                                queries.messagesQuery.refetch(),
                                queries.listThreadsQuery.refetch(),
                            ]);
                        },
                        onError: (message) => {
                            setRunSubmitError(message);
                        },
                    });
                }}
                onEditMessage={(entry: MessageTimelineEntry) => {
                    if (!isEntityId(entry.id, 'msg')) {
                        return;
                    }
                    const editableText = entry.editableText?.trim();
                    if (!editableText) {
                        return;
                    }
                    setPendingMessageEdit({
                        messageId: entry.id,
                        initialText: editableText,
                    });
                }}
                onBranchFromMessage={(entry: MessageTimelineEntry) => {
                    if (!isEntityId(entry.id, 'msg')) {
                        return;
                    }
                    const editableText = entry.editableText?.trim();
                    if (!editableText) {
                        return;
                    }
                    setPendingMessageEdit({
                        messageId: entry.id,
                        initialText: editableText,
                        forcedMode: 'branch',
                    });
                }}
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
                open={Boolean(pendingMessageEdit)}
                initialText={pendingMessageEdit?.initialText ?? ''}
                preferredResolution={editPreference}
                {...(pendingMessageEdit?.forcedMode ? { forcedMode: pendingMessageEdit.forcedMode } : {})}
                busy={mutations.editSessionMutation.isPending || mutations.setEditPreferenceMutation.isPending}
                onCancel={() => {
                    setPendingMessageEdit(undefined);
                }}
                onSave={(input) => {
                    if (!pendingMessageEdit) {
                        return;
                    }
                    if (!isEntityId(selectedSessionId, 'sess')) {
                        setRunSubmitError('Select a session before editing a message.');
                        return;
                    }

                    setRunSubmitError(undefined);
                    void mutations.editSessionMutation
                        .mutateAsync({
                            profileId,
                            sessionId: selectedSessionId,
                            topLevelTab,
                            modeKey,
                            messageId: pendingMessageEdit.messageId,
                            replacementText: input.replacementText,
                            editMode: input.editMode,
                            autoStartRun: true,
                            runtimeOptions: DEFAULT_RUN_OPTIONS,
                            ...(runTargetState.resolvedRunTarget
                                ? { providerId: runTargetState.resolvedRunTarget.providerId }
                                : {}),
                            ...(runTargetState.resolvedRunTarget
                                ? { modelId: runTargetState.resolvedRunTarget.modelId }
                                : {}),
                            ...(selectedThread?.workspaceFingerprint
                                ? { workspaceFingerprint: selectedThread.workspaceFingerprint }
                                : {}),
                        })
                        .then(async (result) => {
                            if (!result.edited) {
                                setRunSubmitError(toEditFailureMessage(result.reason));
                                return;
                            }

                            if (input.rememberChoice && editPreference === 'ask') {
                                await mutations.setEditPreferenceMutation.mutateAsync({
                                    profileId,
                                    value: input.editMode,
                                });
                                void editPreferenceQuery.refetch();
                            }

                            if (result.threadId && isEntityId(result.threadId, 'thr')) {
                                uiState.setSelectedThreadId(result.threadId);
                            }
                            if (result.topLevelTab && result.topLevelTab !== topLevelTab) {
                                onTopLevelTabChange(result.topLevelTab);
                            }
                            uiState.setSelectedSessionId(result.sessionId);
                            if (result.runId) {
                                uiState.setSelectedRunId(result.runId);
                            } else {
                                uiState.setSelectedRunId(undefined);
                            }
                            setPendingMessageEdit(undefined);
                            setPrompt('');
                            void Promise.all([
                                queries.sessionsQuery.refetch(),
                                queries.runsQuery.refetch(),
                                queries.messagesQuery.refetch(),
                                queries.listThreadsQuery.refetch(),
                            ]);
                        })
                        .catch((error: unknown) => {
                            const message = error instanceof Error ? error.message : String(error);
                            setRunSubmitError(`Edit failed: ${message}`);
                        });
                }}
            />
        </main>
    );
}
