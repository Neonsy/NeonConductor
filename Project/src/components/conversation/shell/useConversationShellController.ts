import { useState } from 'react';

import { useConversationShellSessionActions } from '@/web/components/conversation/hooks/useConversationShellSessionActions';
import { useConversationShellViewModel } from '@/web/components/conversation/hooks/useConversationShellViewModel';
import { useConversationUiState } from '@/web/components/conversation/hooks/useConversationUiState';
import { useThreadSidebarState } from '@/web/components/conversation/hooks/useThreadSidebarState';
import { useConversationMutations } from '@/web/components/conversation/shell/actions/useConversationMutations';
import {
    resolveOrchestratorExecutionStrategyDraft,
    resolveOrchestratorStrategyRootThreadId,
    updateOrchestratorExecutionStrategyDraft,
} from '@/web/components/conversation/shell/orchestratorExecutionStrategyDrafts';
import { useConversationQueries } from '@/web/components/conversation/shell/queries/useConversationQueries';
import { useConversationShellCacheHandlers } from '@/web/components/conversation/shell/useConversationShellCacheHandlers';
import { useConversationShellComposerSetup } from '@/web/components/conversation/shell/useConversationShellComposerSetup';
import {
    buildConversationReasoningState,
    DEFAULT_REASONING_EFFORT,
    resolveConversationSelectionIds,
    useConversationShellContextState,
    useConversationShellRunTargetState,
} from '@/web/components/conversation/shell/useConversationShellRunTargetState';
import { useConversationShellViewControllers } from '@/web/components/conversation/shell/useConversationShellViewControllers';
import type {
    ConversationShellMainViewDraftTarget,
    UseConversationShellViewControllersInput,
} from '@/web/components/conversation/shell/useConversationShellViewControllers.types';
import type { ConversationModeOption } from '@/web/components/conversation/shell/workspace/helpers';
import { modeRequiresNativeTools } from '@/web/components/conversation/shell/workspace/helpers';
import type { ConversationShellBootChromeReadiness } from '@/web/components/runtime/bootReadiness';
import { useRuntimeEventStreamStore } from '@/web/lib/runtime/eventStream';
import { trpc } from '@/web/trpc/client';

import type {
    OrchestratorExecutionStrategy,
    RuntimeReasoningEffort,
    TopLevelTab,
} from '@/shared/contracts';

export { buildResolvedContextStateQueryInput } from '@/web/components/conversation/shell/useConversationShellRunTargetState';

export interface ConversationShellProps {
    profileId: string;
    profiles: Array<{ id: string; name: string }>;
    selectedProfileId: string | undefined;
    topLevelTab: TopLevelTab;
    selectedWorkspaceFingerprint?: string;
    modeKey: string;
    modes: ConversationModeOption[];
    onModeChange: (modeKey: string) => void;
    onTopLevelTabChange: (nextTab: TopLevelTab) => void;
    onSelectedWorkspaceFingerprintChange?: (workspaceFingerprint: string | undefined) => void;
    onProfileChange: (profileId: string) => void;
    onBootChromeReadyChange?: (readiness: ConversationShellBootChromeReadiness) => void;
}

interface UseConversationShellControllerInput extends ConversationShellProps {
    isSidebarCollapsed: boolean;
    onToggleSidebarCollapsed: () => void;
}

export function useConversationShellController(input: UseConversationShellControllerInput) {
    return buildConversationShellController(input);
}

function buildConversationShellController(input: UseConversationShellControllerInput) {
    const {
        profileId,
        profiles,
        selectedProfileId,
        topLevelTab,
        selectedWorkspaceFingerprint,
        modeKey,
        modes,
        onModeChange,
        onTopLevelTabChange,
        onSelectedWorkspaceFingerprintChange,
        onProfileChange,
        onBootChromeReadyChange,
        isSidebarCollapsed,
        onToggleSidebarCollapsed,
    } = input;

    const activeMode = modes.find((candidate) => candidate.modeKey === modeKey);
    const activeModeRequiresNativeTools = modeRequiresNativeTools(activeMode);
    const isPlanningComposerMode = modeKey === 'plan' && (topLevelTab === 'agent' || topLevelTab === 'orchestrator');
    const imageAttachmentsAllowed = topLevelTab !== 'orchestrator' && !isPlanningComposerMode;

    const [tabSwitchNotice, setTabSwitchNotice] = useState<string | undefined>(undefined);
    const [focusComposerRequestKey, setFocusComposerRequestKey] = useState(0);
    const [executionStrategyDraftsByRootThreadId, setExecutionStrategyDraftsByRootThreadId] = useState<
        Record<string, OrchestratorExecutionStrategy>
    >({});
    const [requestedReasoningEffort, setRequestedReasoningEffort] =
        useState<RuntimeReasoningEffort>(DEFAULT_REASONING_EFFORT);
    const [mainViewDraftTarget, setMainViewDraftTarget] = useState<ConversationShellMainViewDraftTarget>(undefined);

    const uiState = useConversationUiState(profileId);
    const utils = trpc.useUtils();
    const queries = useConversationQueries({
        profileId,
        uiState,
        selectedSessionId: uiState.selectedSessionId,
        selectedRunId: uiState.selectedRunId,
        topLevelTab,
        modeKey,
    });
    const mutations = useConversationMutations();

    const setEditPreference = async (editPreferenceInput: {
        profileId: string;
        value: 'truncate' | 'branch';
    }): Promise<void> => {
        await mutations.setEditPreferenceMutation.mutateAsync(editPreferenceInput);
    };

    const streamState = useRuntimeEventStreamStore((state) => state.connectionState);
    const streamErrorMessage = useRuntimeEventStreamStore((state) => state.lastError);

    let clearComposerRunSubmitError: () => void = () => undefined;
    let setComposerRunSubmitError: (message: string) => void = () => undefined;
    let applySessionWorkspaceUpdate: UseConversationShellViewControllersInput['applySessionWorkspaceUpdate'] =
        () => undefined;

    const sessionActions = useConversationShellSessionActions({
        profileId,
        selectedThreadId: uiState.selectedThreadId,
        selectedSessionId: uiState.selectedSessionId,
        createSession: mutations.createSessionMutation.mutateAsync,
        onClearError: () => {
            clearComposerRunSubmitError();
        },
        onError: (message) => {
            setComposerRunSubmitError(message);
        },
        onSelectSessionId: uiState.setSelectedSessionId,
        onSelectRunId: uiState.setSelectedRunId,
        onSessionCreated: ({ sessionId, session, thread }) => {
            utils.session.listRuns.setData(
                {
                    profileId,
                    sessionId,
                },
                {
                    runs: [],
                }
            );
            applySessionWorkspaceUpdate({
                session,
                ...(thread ? { thread } : {}),
            });
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

    const initialRunTargetState = useConversationShellRunTargetState({
        shellBootstrapData: queries.shellBootstrapQuery.data,
        selectedWorkspaceFingerprint,
        mainViewDraftTarget,
        sessionOverride: sessionActions.sessionOverride,
        runs: [],
        topLevelTab,
        modeKey,
        requiresNativeTools: activeModeRequiresNativeTools,
        imageAttachmentsAllowed,
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

    const orchestratorStrategyRootThreadId = resolveOrchestratorStrategyRootThreadId({
        topLevelTab,
        selectedThread: shellViewModel.selectedThread,
    });
    const executionStrategy = resolveOrchestratorExecutionStrategyDraft({
        topLevelTab,
        selectedThread: shellViewModel.selectedThread,
        draftsByRootThreadId: executionStrategyDraftsByRootThreadId,
    });
    const handleExecutionStrategyChange = (nextExecutionStrategy: OrchestratorExecutionStrategy): void => {
        setExecutionStrategyDraftsByRootThreadId((currentDrafts) =>
            updateOrchestratorExecutionStrategyDraft({
                draftsByRootThreadId: currentDrafts,
                rootThreadId: orchestratorStrategyRootThreadId,
                executionStrategy: nextExecutionStrategy,
            })
        );
    };

    const runTargetState = useConversationShellRunTargetState({
        shellBootstrapData: queries.shellBootstrapQuery.data,
        selectedWorkspaceFingerprint,
        ...(shellViewModel.selectedThread?.workspaceFingerprint
            ? { selectedThreadWorkspaceFingerprint: shellViewModel.selectedThread.workspaceFingerprint }
            : {}),
        mainViewDraftTarget,
        sessionOverride: sessionActions.sessionOverride,
        runs: shellViewModel.sessionRunSelection.runs,
        topLevelTab,
        modeKey,
        requiresNativeTools: activeModeRequiresNativeTools,
        imageAttachmentsAllowed,
    });

    const { selectedSessionId, selectedRunId, hasSelectedSession } = resolveConversationSelectionIds({
        resolvedSessionId: shellViewModel.sessionRunSelection.selection.resolvedSessionId,
        resolvedRunId: shellViewModel.sessionRunSelection.selection.resolvedRunId,
    });

    const reasoningState = buildConversationReasoningState({
        modelsByProvider: runTargetState.modelsByProvider,
        selectedComposerProviderId: runTargetState.selectedProviderIdForComposer,
        selectedComposerModelId: runTargetState.selectedModelIdForComposer,
        requestedReasoningEffort,
    });

    const cacheHandlers = useConversationShellCacheHandlers({
        utils,
        profileId,
        listThreadsInput: queries.listThreadsInput,
        selectedSessionId,
        topLevelTab,
    });
    applySessionWorkspaceUpdate = cacheHandlers.applySessionWorkspaceUpdate;

    const contextState = useConversationShellContextState({
        profileId,
        selectedSessionId,
        selectedRunId,
        providerId: runTargetState.selectedProviderIdForComposer,
        modelId: runTargetState.selectedModelIdForComposer,
        topLevelTab,
        modeKey,
        workspaceFingerprint: shellViewModel.selectedThread?.workspaceFingerprint,
    });

    const composerSetup = useConversationShellComposerSetup({
        profileId,
        selectedSessionId,
        topLevelTab,
        modeKey,
        workspaceFingerprint: shellViewModel.selectedThread?.workspaceFingerprint,
        sandboxId: shellViewModel.effectiveSelectedSandboxId,
        isPlanningComposerMode,
        imageAttachmentsAllowed,
        activeModeRequiresNativeTools,
        queries,
        mutations,
        uiState,
        runTargetState,
        reasoningState,
        applyPlanWorkspaceUpdate: cacheHandlers.applyPlanWorkspaceUpdate,
        applySessionWorkspaceUpdate: cacheHandlers.applySessionWorkspaceUpdate,
        cacheResolvedContextState: cacheHandlers.cacheResolvedContextState,
    });

    clearComposerRunSubmitError = composerSetup.composer.clearRunSubmitError;
    setComposerRunSubmitError = composerSetup.composer.setRunSubmitError;

    return useConversationShellViewControllers({
        profileId,
        profiles,
        selectedProfileId,
        topLevelTab,
        modeKey,
        modes,
        selectedWorkspaceFingerprint,
        isSidebarCollapsed,
        onToggleSidebarCollapsed,
        onModeChange,
        onTopLevelTabChange,
        onSelectedWorkspaceFingerprintChange,
        onProfileChange,
        onBootChromeReadyChange,
        tabSwitchNotice,
        setTabSwitchNotice,
        focusComposerRequestKey,
        setFocusComposerRequestKey,
        setRequestedReasoningEffort,
        setMainViewDraftTarget,
        queries,
        mutations,
        uiState,
        utils,
        shellViewModel,
        sidebarState,
        runTargetState,
        selectedSessionId,
        selectedRunId,
        hasSelectedSession,
        streamState,
        streamErrorMessage: streamErrorMessage ?? undefined,
        contextStateQueryInput: contextState.contextStateQueryInput,
        contextStateQueryEnabled: contextState.contextStateQueryEnabled,
        contextStateQuery: contextState.contextStateQuery,
        runtimeOptions: reasoningState.runtimeOptions,
        composerMediaSettings: composerSetup.composerMediaSettings,
        composer: composerSetup.composer,
        sessionActions,
        setEditPreference,
        applySessionWorkspaceUpdate: cacheHandlers.applySessionWorkspaceUpdate,
        applyPlanWorkspaceUpdate: cacheHandlers.applyPlanWorkspaceUpdate,
        selectedComposerProviderId: runTargetState.selectedProviderIdForComposer,
        selectedComposerModelId: runTargetState.selectedModelIdForComposer,
        selectedModelSupportsReasoning: reasoningState.selectedModelSupportsReasoning,
        supportedReasoningEfforts: reasoningState.supportedReasoningEfforts,
        effectiveReasoningEffort: reasoningState.effectiveReasoningEffort,
        composerModelOptions: composerSetup.composerModelOptions,
        canAttachImages: composerSetup.canAttachImages,
        imageAttachmentBlockedReason: composerSetup.imageAttachmentBlockedReason,
        selectedModelCompatibilityState: composerSetup.selectedModelCompatibilityState,
        selectedModelCompatibilityReason: composerSetup.selectedModelCompatibilityReason,
        executionStrategy,
        handleExecutionStrategyChange,
    });
}
