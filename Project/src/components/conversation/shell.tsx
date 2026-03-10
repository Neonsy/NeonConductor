import { useEffect, useEffectEvent, useState } from 'react';

import { useConversationShellComposer } from '@/web/components/conversation/hooks/useConversationShellComposer';
import { useConversationShellEditFlow } from '@/web/components/conversation/hooks/useConversationShellEditFlow';
import { useConversationShellRoutingBadge } from '@/web/components/conversation/hooks/useConversationShellRoutingBadge';
import { useConversationShellSessionActions } from '@/web/components/conversation/hooks/useConversationShellSessionActions';
import { useConversationShellViewModel } from '@/web/components/conversation/hooks/useConversationShellViewModel';
import { useConversationUiState } from '@/web/components/conversation/hooks/useConversationUiState';
import { useThreadSidebarState } from '@/web/components/conversation/hooks/useThreadSidebarState';
import { MessageEditDialog } from '@/web/components/conversation/panels/messageEditDialog';
import { useConversationMutations } from '@/web/components/conversation/shell/actions/useConversationMutations';
import { buildConversationPlanOrchestrator } from '@/web/components/conversation/shell/composition/buildConversationPlanOrchestrator';
import { buildConversationWorkspacePanels } from '@/web/components/conversation/shell/composition/buildConversationWorkspacePanels';
import { buildConversationWorkspaceSectionState } from '@/web/components/conversation/shell/composition/buildConversationWorkspaceSectionState';
import { ConversationWorkspaceSection } from '@/web/components/conversation/shell/composition/conversationWorkspaceSection';
import { useConversationQueries } from '@/web/components/conversation/shell/queries/useConversationQueries';
import { useConversationRefetch } from '@/web/components/conversation/shell/queries/useConversationRefetch';
import { useConversationSync } from '@/web/components/conversation/shell/queries/useConversationSync';
import { DEFAULT_RUN_OPTIONS, isEntityId, isProviderId } from '@/web/components/conversation/shell/workspace/helpers';
import { useConversationRunTarget } from '@/web/components/conversation/shell/workspace/useConversationRunTarget';
import { useConversationWorkspaceActions } from '@/web/components/conversation/shell/workspace/useConversationWorkspaceActions';
import { ConversationSidebarPane } from '@/web/components/conversation/sidebar/conversationSidebarPane';
import { useRuntimeEventStreamStore } from '@/web/lib/runtime/eventStream';
import { trpc } from '@/web/trpc/client';

import type { TopLevelTab } from '@/app/backend/runtime/contracts';
import type { ConversationShellBootChromeReadiness } from '@/web/components/runtime/bootReadiness';

interface ConversationShellProps {
    profileId: string;
    topLevelTab: TopLevelTab;
    modeKey: string;
    onTopLevelTabChange: (nextTab: TopLevelTab) => void;
    onSelectedWorkspaceFingerprintChange?: (workspaceFingerprint: string | undefined) => void;
    onBootChromeReadyChange?: (readiness: ConversationShellBootChromeReadiness) => void;
}

export function ConversationShell({
    profileId,
    topLevelTab,
    modeKey,
    onTopLevelTabChange,
    onSelectedWorkspaceFingerprintChange,
    onBootChromeReadyChange,
}: ConversationShellProps) {
    const [tabSwitchNotice, setTabSwitchNotice] = useState<string | undefined>(undefined);
    const [contextFeedbackMessage, setContextFeedbackMessage] = useState<string | undefined>(undefined);
    const [contextFeedbackTone, setContextFeedbackTone] = useState<'success' | 'error' | 'info'>('info');
    const uiState = useConversationUiState(profileId);
    const utils = trpc.useUtils();
    const queries = useConversationQueries({
        profileId,
        uiState,
        selectedSessionId: uiState.selectedSessionId,
        selectedRunId: uiState.selectedRunId,
        topLevelTab,
    });
    const mutations = useConversationMutations();
    const refetch = useConversationRefetch({ queries });
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
        selectedTagIds: uiState.selectedTagIds,
        selectedThreadId: uiState.selectedThreadId,
        onSelectedThreadInvalid: () => {
            uiState.setSelectedThreadId(undefined);
        },
        onSelectFallbackThread: (threadId) => {
            uiState.setSelectedThreadId(threadId);
        },
    });
    const initialRunTargetState = useConversationRunTarget({
        providers: queries.shellBootstrapQuery.data?.providers ?? [],
        providerModels: queries.shellBootstrapQuery.data?.providerModels ?? [],
        defaults: queries.shellBootstrapQuery.data?.defaults,
        runs: [],
        ...(sessionActions.sessionOverride ? { sessionOverride: sessionActions.sessionOverride } : {}),
    });
    const shellViewModel = useConversationShellViewModel({
        profileId,
        topLevelTab,
        modeKey,
        queries,
        uiState,
        sidebarState,
        runTargetState: initialRunTargetState,
    });
    const runTargetState = useConversationRunTarget({
        providers: queries.shellBootstrapQuery.data?.providers ?? [],
        providerModels: queries.shellBootstrapQuery.data?.providerModels ?? [],
        defaults: queries.shellBootstrapQuery.data?.defaults,
        runs: shellViewModel.sessionRunSelection.runs,
        ...(sessionActions.sessionOverride ? { sessionOverride: sessionActions.sessionOverride } : {}),
    });
    const fallbackContextSessionId = 'sess_missing';
    const hasSelectedSession = isEntityId(selectedSessionId, 'sess');
    const contextSessionId = hasSelectedSession ? selectedSessionId : fallbackContextSessionId;
    const contextProviderId = runTargetState.selectedProviderIdForComposer ?? 'openai';
    const contextModelId = runTargetState.selectedModelIdForComposer ?? 'openai/gpt-5';
    const isPlanningComposerMode = modeKey === 'plan' && (topLevelTab === 'agent' || topLevelTab === 'orchestrator');
    const canAttachImages =
        topLevelTab !== 'orchestrator' &&
        !isPlanningComposerMode &&
        Boolean(runTargetState.selectedModelForComposer?.supportsVision);
    const imageAttachmentBlockedReason = isPlanningComposerMode
        ? 'Image attachments are only available for executable runs.'
        : runTargetState.selectedModelForComposer?.supportsVision
          ? undefined
          : 'Select a vision-capable model to attach images.';
    const contextStateQuery = trpc.context.getResolvedState.useQuery(
        {
            profileId,
            sessionId: contextSessionId,
            providerId: contextProviderId,
            modelId: contextModelId,
            topLevelTab,
            modeKey,
            ...(shellViewModel.selectedThread?.workspaceFingerprint
                ? { workspaceFingerprint: shellViewModel.selectedThread.workspaceFingerprint }
                : {}),
        },
        {
            enabled:
                hasSelectedSession &&
                topLevelTab !== 'orchestrator' &&
                Boolean(runTargetState.selectedProviderIdForComposer) &&
                Boolean(runTargetState.selectedModelIdForComposer),
            refetchOnWindowFocus: false,
        }
    );
    const composer = useConversationShellComposer({
        profileId,
        selectedSessionId,
        isPlanningMode: isPlanningComposerMode,
        topLevelTab,
        modeKey,
        workspaceFingerprint: shellViewModel.selectedThread?.workspaceFingerprint,
        ...(shellViewModel.effectiveSelectedWorktreeId
            ? { worktreeId: shellViewModel.effectiveSelectedWorktreeId }
            : {}),
        resolvedRunTarget: runTargetState.resolvedRunTarget,
        providerById: runTargetState.providerById,
        runtimeOptions: DEFAULT_RUN_OPTIONS,
        isStartingRun: mutations.startRunMutation.isPending,
        canAttachImages,
        ...(imageAttachmentBlockedReason ? { imageAttachmentBlockedReason } : {}),
        startPlan: mutations.planStartMutation.mutateAsync,
        startRun: mutations.startRunMutation.mutateAsync,
        refetchActivePlan: () => {
            void queries.activePlanQuery.refetch();
        },
        refetchSessionWorkspace: () => {
            void refetch.refetchSessionWorkspace();
            void contextStateQuery.refetch();
        },
    });
    const editFlow = useConversationShellEditFlow({
        profileId,
        topLevelTab,
        modeKey,
        selectedSessionId,
        selectedThread: shellViewModel.selectedThread,
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
    const resetForProfile = useEffectEvent(() => {
        setTabSwitchNotice(undefined);
        composer.resetComposer();
        sessionActions.resetSessionActions();
        editFlow.resetEditFlow();
    });

    useConversationSync({
        profileId,
        uiState,
        threads: queries.listThreadsQuery.data,
        tags: queries.listTagsQuery.data?.tags,
        buckets: queries.listBucketsQuery.data?.buckets,
        onProfileReset: resetForProfile,
    });

    useEffect(() => {
        onSelectedWorkspaceFingerprintChange?.(shellViewModel.selectedThread?.workspaceFingerprint);
    }, [onSelectedWorkspaceFingerprintChange, shellViewModel.selectedThread?.workspaceFingerprint]);

    useEffect(() => {
        onBootChromeReadyChange?.({
            shellBootstrapSettled: !queries.shellBootstrapQuery.isPending,
        });

        return () => {
            onBootChromeReadyChange?.({
                shellBootstrapSettled: false,
            });
        };
    }, [onBootChromeReadyChange, queries.shellBootstrapQuery.isPending]);

    const sidebarStatusMessage = queries.listBucketsQuery.isPending
        ? 'Loading conversation groups...'
        : queries.listTagsQuery.isPending
          ? 'Loading tags...'
          : queries.listThreadsQuery.isPending
            ? 'Loading threads...'
            : queries.sessionsQuery.isPending
              ? 'Loading sessions...'
              : queries.listBucketsQuery.error?.message ??
                queries.listTagsQuery.error?.message ??
                queries.listThreadsQuery.error?.message ??
                queries.sessionsQuery.error?.message;
    const sidebarStatusTone = queries.listBucketsQuery.error ??
        queries.listTagsQuery.error ??
        queries.listThreadsQuery.error ??
        queries.sessionsQuery.error
        ? 'error'
        : sidebarStatusMessage
          ? 'info'
          : undefined;

    const routingBadge = useConversationShellRoutingBadge({
        profileId,
        providerId: runTargetState.selectedProviderIdForComposer,
        modelId: runTargetState.selectedModelIdForComposer,
    });
    const planOrchestrator = buildConversationPlanOrchestrator({
        profileId,
        refetchPlanWorkspace: refetch.refetchPlanWorkspace,
        onError: composer.setRunSubmitError,
        resolvedRunTarget: runTargetState.resolvedRunTarget,
        workspaceFingerprint: shellViewModel.selectedThread?.workspaceFingerprint,
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
    const workspaceActions = useConversationWorkspaceActions({
        profileId,
        mutations,
        onResolvePermission: composer.clearRunSubmitError,
    });
    const workspaceSectionState = buildConversationWorkspaceSectionState({
        topLevelTab,
        modeKey,
        shellViewModel,
        queries,
        runTargetState,
    });
    const workspacePanels = buildConversationWorkspacePanels({
        profileId,
        topLevelTab,
        selectedSessionId,
        selectedRunId,
        modeKey,
        shellViewModel,
        queries,
        mutations,
        planOrchestrator,
        workspaceActions,
    });

    return (
        <main className='bg-background flex min-h-0 flex-1 overflow-hidden'>
            <ConversationSidebarPane
                profileId={profileId}
                topLevelTab={topLevelTab}
                buckets={queries.listBucketsQuery.data?.buckets ?? []}
                threads={sidebarState.visibleThreads}
                tags={queries.listTagsQuery.data?.tags ?? []}
                threadTagIdsByThread={sidebarState.threadTagIdsByThread}
                selectedThreadId={uiState.selectedThreadId}
                selectedTagIds={uiState.selectedTagIds}
                scopeFilter={uiState.scopeFilter}
                workspaceFilter={uiState.workspaceFilter}
                sort={uiState.sort ?? 'latest'}
                showAllModes={uiState.showAllModes}
                groupView={uiState.groupView}
                isCreatingThread={mutations.createThreadMutation.isPending}
                isAddingTag={mutations.upsertTagMutation.isPending || mutations.setThreadTagsMutation.isPending}
                isDeletingWorkspaceThreads={mutations.deleteWorkspaceThreadsMutation.isPending}
                {...(sidebarStatusMessage
                    ? {
                          statusMessage: sidebarStatusMessage,
                          ...(sidebarStatusTone ? { statusTone: sidebarStatusTone } : {}),
                      }
                    : {})}
                onTopLevelTabChange={onTopLevelTabChange}
                onSetTabSwitchNotice={setTabSwitchNotice}
                onSelectThreadId={uiState.setSelectedThreadId}
                onSelectSessionId={uiState.setSelectedSessionId}
                onSelectRunId={uiState.setSelectedRunId}
                onSelectTagIds={uiState.setSelectedTagIds}
                onScopeFilterChange={uiState.setScopeFilter}
                onWorkspaceFilterChange={uiState.setWorkspaceFilter}
                onSortChange={uiState.setSort}
                onShowAllModesChange={uiState.setShowAllModes}
                onGroupViewChange={uiState.setGroupView}
                createThread={mutations.createThreadMutation.mutateAsync}
                upsertTag={mutations.upsertTagMutation.mutateAsync}
                setThreadTags={mutations.setThreadTagsMutation.mutateAsync}
                setThreadFavorite={mutations.setThreadFavoriteMutation.mutateAsync}
                deleteWorkspaceThreads={mutations.deleteWorkspaceThreadsMutation.mutateAsync}
                refetchBuckets={queries.listBucketsQuery.refetch}
                refetchThreads={queries.listThreadsQuery.refetch}
                refetchTags={queries.listTagsQuery.refetch}
                refetchShellBootstrap={queries.shellBootstrapQuery.refetch}
                refetchSessions={queries.sessionsQuery.refetch}
            />

            <ConversationWorkspaceSection
                profileId={profileId}
                selectedThread={shellViewModel.selectedThread}
                selectedSessionId={selectedSessionId}
                selectedRunId={selectedRunId}
                streamState={streamState}
                lastSequence={queries.shellBootstrapQuery.data?.lastSequence ?? 0}
                tabSwitchNotice={tabSwitchNotice}
                sessions={shellViewModel.sessionRunSelection.sessions}
                runs={shellViewModel.sessionRunSelection.runs}
                messages={shellViewModel.sessionRunSelection.messages}
                partsByMessageId={shellViewModel.sessionRunSelection.partsByMessageId}
                executionPreset={queries.shellBootstrapQuery.data?.executionPreset ?? 'standard'}
                workspaceScope={shellViewModel.workspaceScope}
                pendingPermissions={shellViewModel.pendingPermissions}
                permissionWorkspaces={shellViewModel.permissionWorkspaces}
                prompt={composer.prompt}
                pendingImages={composer.pendingImages}
                isCreatingSession={mutations.createSessionMutation.isPending}
                isStartingRun={mutations.startRunMutation.isPending || mutations.planStartMutation.isPending}
                isResolvingPermission={mutations.resolvePermissionMutation.isPending}
                canCreateSession={Boolean(uiState.selectedThreadId)}
                selectedProviderId={runTargetState.selectedProviderIdForComposer}
                selectedModelId={runTargetState.selectedModelIdForComposer}
                canAttachImages={canAttachImages}
                {...(imageAttachmentBlockedReason ? { imageAttachmentBlockedReason } : {})}
                routingBadge={routingBadge}
                {...workspaceSectionState}
                providerOptions={runTargetState.providerOptions}
                modelOptions={runTargetState.modelOptions}
                runErrorMessage={composer.runSubmitError}
                {...(contextStateQuery.data ? { contextState: contextStateQuery.data } : {})}
                {...(contextFeedbackMessage
                    ? {
                          contextFeedbackMessage,
                          contextFeedbackTone,
                      }
                    : {})}
                canCompactContext={
                    topLevelTab !== 'orchestrator' &&
                    hasSelectedSession &&
                    Boolean(contextStateQuery.data?.compactable)
                }
                isCompactingContext={mutations.compactSessionMutation.isPending}
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
                onAddImageFiles={composer.onAddImageFiles}
                onRemovePendingImage={composer.onRemovePendingImage}
                onRetryPendingImage={composer.onRetryPendingImage}
                onSubmitPrompt={composer.onSubmitPrompt}
                onCompactContext={() => {
                    if (!hasSelectedSession) {
                        return;
                    }

                    setContextFeedbackMessage(undefined);
                    void mutations.compactSessionMutation
                        .mutateAsync({
                            profileId,
                            sessionId: contextSessionId,
                            providerId: contextProviderId,
                            modelId: contextModelId,
                            topLevelTab,
                            ...(shellViewModel.selectedThread?.workspaceFingerprint
                                ? { workspaceFingerprint: shellViewModel.selectedThread.workspaceFingerprint }
                                : {}),
                        })
                        .then(async () => {
                            await utils.context.getResolvedState.invalidate({
                                profileId,
                                sessionId: contextSessionId,
                                providerId: contextProviderId,
                                modelId: contextModelId,
                                topLevelTab,
                                modeKey,
                                ...(shellViewModel.selectedThread?.workspaceFingerprint
                                    ? { workspaceFingerprint: shellViewModel.selectedThread.workspaceFingerprint }
                                    : {}),
                            });
                            setContextFeedbackTone('success');
                            setContextFeedbackMessage('Context compacted for the current session.');
                        })
                        .catch((error: unknown) => {
                            setContextFeedbackTone('error');
                            setContextFeedbackMessage(
                                error instanceof Error ? error.message : 'Context compaction failed.'
                            );
                        });
                }}
                onResolvePermission={(requestId, resolution, selectedApprovalResource) => {
                    void workspaceActions.resolvePermission(
                        selectedApprovalResource
                            ? { requestId, resolution, selectedApprovalResource }
                            : { requestId, resolution }
                    );
                }}
                onEditMessage={editFlow.onEditMessage}
                onBranchFromMessage={editFlow.onBranchFromMessage}
                modePanel={workspacePanels.modePanel}
                executionEnvironmentPanel={workspacePanels.executionEnvironmentPanel}
                attachedSkillsPanel={workspacePanels.attachedSkillsPanel}
                diffCheckpointPanel={workspacePanels.diffCheckpointPanel}
            />

            <MessageEditDialog
                {...editFlow.dialogProps}
                busy={mutations.editSessionMutation.isPending || mutations.setEditPreferenceMutation.isPending}
            />
        </main>
    );
}
