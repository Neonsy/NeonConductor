import { useEffect, useState } from 'react';

import { useConversationShellMutations } from '@/web/components/conversation/conversationShellMutations';
import { buildConversationShellPlanOrchestrator } from '@/web/components/conversation/conversationShellPlanOrchestrator';
import { useConversationShellQueries } from '@/web/components/conversation/conversationShellQueries';
import { useConversationShellRunTarget } from '@/web/components/conversation/conversationShellRunTarget';
import { useConversationUiState } from '@/web/components/conversation/hooks/useConversationUiState';
import { useSessionRunSelection } from '@/web/components/conversation/hooks/useSessionRunSelection';
import { useThreadSidebarState } from '@/web/components/conversation/hooks/useThreadSidebarState';
import { ModeExecutionPanel } from '@/web/components/conversation/panels/modeExecutionPanel';
import { SessionWorkspacePanel } from '@/web/components/conversation/sessionWorkspacePanel';
import { DEFAULT_RUN_OPTIONS, isEntityId, isProviderId } from '@/web/components/conversation/shellHelpers';
import { submitPrompt as submitPromptFromComposer } from '@/web/components/conversation/shellPromptSubmit';
import { ConversationSidebar } from '@/web/components/conversation/sidebar';
import { useRuntimeEventStreamStore } from '@/web/lib/runtime/eventStream';
import { useRuntimeSnapshot } from '@/web/lib/runtime/useRuntimeSnapshot';

import type { EntityId, RuntimeProviderId, TopLevelTab } from '@/app/backend/runtime/contracts';

interface ConversationShellProps {
    profileId: string;
    topLevelTab: TopLevelTab;
    modeKey: string;
}

export function ConversationShell({ profileId, topLevelTab, modeKey }: ConversationShellProps) {
    const [prompt, setPrompt] = useState('');
    const [runSubmitError, setRunSubmitError] = useState<string | undefined>(undefined);
    const [sessionTargetBySessionId, setSessionTargetBySessionId] = useState<
        Record<string, { providerId?: RuntimeProviderId; modelId?: string }>
    >({});
    const uiState = useConversationUiState(profileId);

    const runtimeSnapshot = useRuntimeSnapshot(profileId);
    const queries = useConversationShellQueries({
        profileId,
        uiState,
        selectedSessionId: uiState.selectedSessionId,
        topLevelTab,
    });
    const mutations = useConversationShellMutations();

    useEffect(() => {
        setPrompt('');
        setRunSubmitError(undefined);
        setSessionTargetBySessionId({});
    }, [profileId]);

    useEffect(() => {
        if (uiState.sort || !queries.listThreadsQuery.data?.sort) {
            return;
        }

        uiState.setSort(queries.listThreadsQuery.data.sort);
    }, [queries.listThreadsQuery.data?.sort, uiState]);

    useEffect(() => {
        const selectedTagId = uiState.selectedTagId;
        if (!selectedTagId) {
            return;
        }

        const tagExists = (queries.listTagsQuery.data?.tags ?? []).some((tag) => tag.id === selectedTagId);
        if (!tagExists) {
            uiState.setSelectedTagId(undefined);
        }
    }, [queries.listTagsQuery.data?.tags, uiState]);

    useEffect(() => {
        const workspaceFilter = uiState.workspaceFilter;
        if (!workspaceFilter) {
            return;
        }

        const workspaceExists = (queries.listBucketsQuery.data?.buckets ?? [])
            .filter((bucket) => bucket.scope === 'workspace')
            .some((bucket) => bucket.workspaceFingerprint === workspaceFilter);
        if (!workspaceExists) {
            uiState.setWorkspaceFilter(undefined);
        }
    }, [queries.listBucketsQuery.data?.buckets, uiState]);

    const streamState = useRuntimeEventStreamStore((state) => state.connectionState);

    const sidebarState = useThreadSidebarState({
        threads: queries.listThreadsQuery.data?.threads ?? [],
        threadTags: runtimeSnapshot.data?.threadTags ?? [],
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
        allSessions: runtimeSnapshot.data?.sessions ?? [],
        allRuns: runtimeSnapshot.data?.runs ?? [],
        allMessages: runtimeSnapshot.data?.messages ?? [],
        allMessageParts: runtimeSnapshot.data?.messageParts ?? [],
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

    const selectedThreadId = uiState.selectedThreadId;
    const selectedSessionId = uiState.selectedSessionId;
    const selectedRunId = uiState.selectedRunId;
    const selectedTagId = uiState.selectedTagId;
    const workspaceFilter = uiState.workspaceFilter;
    const sessionOverride = selectedSessionId ? sessionTargetBySessionId[selectedSessionId] : undefined;
    const runTargetState = useConversationShellRunTarget({
        providers: runtimeSnapshot.data?.providers ?? [],
        providerModels: runtimeSnapshot.data?.providerModels ?? [],
        defaults: runtimeSnapshot.data?.defaults,
        runs: sessionRunSelection.runs,
        ...(sessionOverride ? { sessionOverride } : {}),
    });
    const isPlanningMode = modeKey === 'plan' && (topLevelTab === 'agent' || topLevelTab === 'orchestrator');

    const planOrchestrator = buildConversationShellPlanOrchestrator({
        profileId,
        runtimeSnapshotRefetch: runtimeSnapshot.refetch,
        activePlanRefetch: queries.activePlanQuery.refetch,
        orchestratorLatestRefetch: queries.orchestratorLatestQuery.refetch,
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
            <ConversationSidebar
                buckets={queries.listBucketsQuery.data?.buckets ?? []}
                threads={sidebarState.visibleThreads}
                tags={queries.listTagsQuery.data?.tags ?? []}
                threadTagIdsByThread={sidebarState.threadTagIdsByThread}
                {...(selectedThreadId ? { selectedThreadId } : {})}
                {...(selectedTagId ? { selectedTagId } : {})}
                scopeFilter={uiState.scopeFilter}
                {...(workspaceFilter ? { workspaceFilter } : {})}
                sort={uiState.sort ?? 'latest'}
                isCreatingThread={mutations.createThreadMutation.isPending}
                isAddingTag={mutations.upsertTagMutation.isPending || mutations.setThreadTagsMutation.isPending}
                onSelectThread={(threadId) => {
                    uiState.setSelectedThreadId(threadId);
                }}
                onToggleTagFilter={(tagId) => {
                    uiState.setSelectedTagId((current) => (current === tagId ? undefined : tagId));
                }}
                onScopeFilterChange={(nextScope) => {
                    uiState.setScopeFilter(nextScope);
                    if (nextScope !== 'workspace') {
                        uiState.setWorkspaceFilter(undefined);
                    }
                }}
                onWorkspaceFilterChange={uiState.setWorkspaceFilter}
                onSortChange={(nextSort) => {
                    uiState.setSort(nextSort);
                }}
                onCreateThread={async (input) => {
                    const result = await mutations.createThreadMutation.mutateAsync({
                        profileId,
                        ...input,
                    });
                    uiState.setSelectedThreadId(result.thread.id);
                    void queries.listBucketsQuery.refetch();
                    void queries.listThreadsQuery.refetch();
                    void runtimeSnapshot.refetch();
                }}
                onAddTagToThread={async (threadId, label) => {
                    if (!isEntityId(threadId, 'thr')) {
                        return;
                    }

                    const upserted = await mutations.upsertTagMutation.mutateAsync({
                        profileId,
                        label,
                    });
                    const existing = sidebarState.threadTagIdsByThread.get(threadId) ?? [];
                    const nextTagIds = [...new Set([...existing, upserted.tag.id])];
                    const validTagIds = nextTagIds.filter((tagId): tagId is EntityId<'tag'> =>
                        isEntityId(tagId, 'tag')
                    );
                    if (validTagIds.length !== nextTagIds.length) {
                        return;
                    }

                    await mutations.setThreadTagsMutation.mutateAsync({
                        profileId,
                        threadId,
                        tagIds: validTagIds,
                    });
                    void queries.listTagsQuery.refetch();
                    void runtimeSnapshot.refetch();
                }}
            />

            <section className='flex min-h-0 flex-1 flex-col'>
                <header className='border-border flex items-center justify-between border-b px-4 py-3'>
                    <div className='min-w-0'>
                        <p className='truncate text-sm font-semibold'>
                            {selectedThread?.title ?? 'No Thread Selected'}
                        </p>
                        <p className='text-muted-foreground text-xs'>
                            Stream: {streamState} · Events: {runtimeSnapshot.data?.lastSequence ?? 0}
                        </p>
                    </div>
                </header>

                <SessionWorkspacePanel
                    sessions={sessionRunSelection.sessions}
                    runs={sessionRunSelection.runs}
                    messages={sessionRunSelection.messages}
                    partsByMessageId={sessionRunSelection.partsByMessageId}
                    {...(selectedSessionId ? { selectedSessionId } : {})}
                    {...(selectedRunId ? { selectedRunId } : {})}
                    prompt={prompt}
                    isCreatingSession={mutations.createSessionMutation.isPending}
                    isStartingRun={mutations.startRunMutation.isPending || mutations.planStartMutation.isPending}
                    canCreateSession={Boolean(selectedThreadId)}
                    selectedProviderId={runTargetState.selectedProviderIdForComposer}
                    selectedModelId={runTargetState.selectedModelIdForComposer}
                    providerOptions={runTargetState.providerOptions}
                    modelOptions={runTargetState.modelOptions}
                    runErrorMessage={runSubmitError}
                    onSelectSession={(sessionId) => {
                        setRunSubmitError(undefined);
                        uiState.setSelectedSessionId(sessionId);
                    }}
                    onSelectRun={(runId) => {
                        uiState.setSelectedRunId(runId);
                    }}
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
                        if (!isEntityId(selectedThreadId, 'thr')) {
                            return;
                        }

                        void mutations.createSessionMutation
                            .mutateAsync({
                                profileId,
                                threadId: selectedThreadId,
                                kind: 'local',
                            })
                            .then((result) => {
                                uiState.setSelectedSessionId(result.session.id);
                                setRunSubmitError(undefined);
                                void runtimeSnapshot.refetch();
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
                                void runtimeSnapshot.refetch();
                            },
                            onError: (message) => {
                                setRunSubmitError(message);
                            },
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
            </section>
        </main>
    );
}
