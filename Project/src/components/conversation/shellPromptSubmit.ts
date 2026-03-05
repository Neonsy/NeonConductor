import {
    isEntityId,
    isProviderRunnable,
    toActionableRunError,
    type RunTargetSelection,
} from '@/web/components/conversation/shellHelpers';

import type { RuntimeRunOptions } from '@/app/backend/runtime/contracts';
import type {
    PlanStartInput,
    SessionStartRunInput,
    RuntimeProviderId,
    TopLevelTab,
} from '@/app/backend/runtime/contracts';

interface ProviderAuthView {
    label: string;
    authState: string;
    authMethod: string;
}

interface SubmitPromptInput {
    prompt: string;
    isStartingRun: boolean;
    selectedSessionId: string | undefined;
    isPlanningMode: boolean;
    profileId: string;
    topLevelTab: TopLevelTab;
    modeKey: string;
    workspaceFingerprint: string | undefined;
    resolvedRunTarget: RunTargetSelection | undefined;
    runtimeOptions: RuntimeRunOptions;
    providerById: Map<RuntimeProviderId, ProviderAuthView>;
    startPlan: (input: PlanStartInput) => Promise<unknown>;
    startRun: (input: SessionStartRunInput) => Promise<unknown>;
    onPromptCleared: () => void;
    onPlanRefetch: () => void;
    onRuntimeRefetch: () => void;
    onError: (message: string) => void;
}

export async function submitPrompt(input: SubmitPromptInput): Promise<void> {
    if (input.prompt.trim().length === 0 || input.isStartingRun) {
        return;
    }

    if (!isEntityId(input.selectedSessionId, 'sess')) {
        return;
    }

    if (input.isPlanningMode) {
        try {
            await input.startPlan({
                profileId: input.profileId,
                sessionId: input.selectedSessionId,
                topLevelTab: input.topLevelTab,
                modeKey: input.modeKey,
                prompt: input.prompt.trim(),
                ...(input.workspaceFingerprint ? { workspaceFingerprint: input.workspaceFingerprint } : {}),
            });
            input.onPromptCleared();
            input.onPlanRefetch();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            input.onError(`Plan start failed: ${message}`);
        }
        return;
    }

    if (!input.resolvedRunTarget) {
        input.onError('No runnable provider/model found. Open Settings > Providers to configure one.');
        return;
    }

    const selectedProvider = input.providerById.get(input.resolvedRunTarget.providerId);
    if (selectedProvider && !isProviderRunnable(selectedProvider.authState, selectedProvider.authMethod)) {
        input.onError(
            `${selectedProvider.label} is not authenticated. Open Settings > Providers to connect it before running.`
        );
        return;
    }

    try {
        await input.startRun({
            profileId: input.profileId,
            sessionId: input.selectedSessionId,
            prompt: input.prompt.trim(),
            topLevelTab: input.topLevelTab,
            modeKey: input.modeKey,
            providerId: input.resolvedRunTarget.providerId,
            modelId: input.resolvedRunTarget.modelId,
            ...(input.workspaceFingerprint ? { workspaceFingerprint: input.workspaceFingerprint } : {}),
            runtimeOptions: input.runtimeOptions,
        });
        input.onPromptCleared();
        input.onRuntimeRefetch();
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        const providerLabel = selectedProvider?.label ?? input.resolvedRunTarget.providerId;
        input.onError(toActionableRunError(message, providerLabel));
    }
}
