import { useState } from 'react';

import { submitPrompt as submitPromptFromComposer } from '@/web/components/conversation/shellPromptSubmit';

import type {
    PlanStartInput,
    RuntimeProviderId,
    RuntimeRunOptions,
    SessionStartRunInput,
    TopLevelTab,
} from '@/app/backend/runtime/contracts';

interface ProviderAuthView {
    label: string;
    authState: string;
    authMethod: string;
}

interface UseConversationShellComposerInput {
    profileId: string;
    selectedSessionId: string | undefined;
    isPlanningMode: boolean;
    topLevelTab: TopLevelTab;
    modeKey: string;
    workspaceFingerprint: string | undefined;
    resolvedRunTarget:
        | {
              providerId: RuntimeProviderId;
              modelId: string;
          }
        | undefined;
    providerById: Map<RuntimeProviderId, ProviderAuthView>;
    runtimeOptions: RuntimeRunOptions;
    isStartingRun: boolean;
    startPlan: (input: PlanStartInput) => Promise<unknown>;
    startRun: (input: SessionStartRunInput) => Promise<unknown>;
    refetchActivePlan: () => void;
    refetchSessionWorkspace: () => void;
}

export function useConversationShellComposer(input: UseConversationShellComposerInput) {
    const [prompt, setPrompt] = useState('');
    const [runSubmitError, setRunSubmitError] = useState<string | undefined>(undefined);

    return {
        prompt,
        runSubmitError,
        setRunSubmitError,
        clearRunSubmitError: () => {
            setRunSubmitError(undefined);
        },
        resetComposer: () => {
            setPrompt('');
            setRunSubmitError(undefined);
        },
        onPromptChange: (nextPrompt: string) => {
            setRunSubmitError(undefined);
            setPrompt(nextPrompt);
        },
        onSubmitPrompt: () => {
            void submitPromptFromComposer({
                prompt,
                isStartingRun: input.isStartingRun,
                selectedSessionId: input.selectedSessionId,
                isPlanningMode: input.isPlanningMode,
                profileId: input.profileId,
                topLevelTab: input.topLevelTab,
                modeKey: input.modeKey,
                workspaceFingerprint: input.workspaceFingerprint,
                resolvedRunTarget: input.resolvedRunTarget,
                runtimeOptions: input.runtimeOptions,
                providerById: input.providerById,
                startPlan: input.startPlan,
                startRun: input.startRun,
                onPromptCleared: () => {
                    setRunSubmitError(undefined);
                    setPrompt('');
                },
                onPlanRefetch: () => {
                    input.refetchActivePlan();
                },
                onRuntimeRefetch: () => {
                    input.refetchSessionWorkspace();
                },
                onError: (message) => {
                    setRunSubmitError(message);
                },
            });
        },
    };
}
