import type { PlanningDepth } from '@/web/components/conversation/shell/planningDepth';
import type {
    ConversationSessionActions,
    ConversationShellMainViewDraftTarget,
} from '@/web/components/conversation/shell/useConversationShellViewControllers.types';
import {
    resolveModeRoutingIntent,
    type ConversationModeOption,
} from '@/web/components/conversation/shell/workspace/helpers';
import { useConversationRunTarget } from '@/web/components/conversation/shell/workspace/useConversationRunTarget';
import {
    getProviderControlDefaults,
    getProviderControlSpecialistDefaults,
    getProviderControlWorkflowRoutingPreferences,
    listProviderControlModels,
    listProviderControlProviders,
} from '@/web/lib/providerControl/selectors';

import type { RunRecord } from '@/app/backend/persistence/types';

import type { RuntimeShellBootstrap } from '@/shared/contracts';
import { resolvePlanningWorkflowRoutingTarget } from '@/shared/workflowRouting';

interface UseConversationComposerTargetStateInput {
    shellBootstrapData: RuntimeShellBootstrap | undefined;
    selectedWorkspaceFingerprint: string | undefined;
    selectedThreadWorkspaceFingerprint?: string;
    mainViewDraftTarget: ConversationShellMainViewDraftTarget;
    sessionOverride: ConversationSessionActions['sessionOverride'];
    runs: RunRecord[];
    activeMode?: ConversationModeOption;
    modeKey: string;
    isPlanningComposerMode: boolean;
    planningDepth: PlanningDepth;
    activePlanPlanningDepth?: PlanningDepth;
    imageAttachmentsAllowed: boolean;
}

export function useConversationComposerTargetState(input: UseConversationComposerTargetStateInput) {
    const providerControl = input.shellBootstrapData?.providerControl;
    const preferredWorkspacePreference = findConversationWorkspacePreference({
        workspacePreferences: input.shellBootstrapData?.workspacePreferences,
        preferredWorkspaceFingerprint: input.selectedThreadWorkspaceFingerprint ?? input.selectedWorkspaceFingerprint,
    });
    const planningDepth = input.activePlanPlanningDepth ?? input.planningDepth;
    const workflowRoutingTarget = input.isPlanningComposerMode
        ? resolvePlanningWorkflowRoutingTarget(planningDepth)
        : undefined;

    return useConversationRunTarget({
        providers: listProviderControlProviders(providerControl),
        providerModels: listProviderControlModels(providerControl),
        defaults: getProviderControlDefaults(providerControl),
        specialistDefaults: getProviderControlSpecialistDefaults(providerControl),
        workflowRoutingPreferences: getProviderControlWorkflowRoutingPreferences(providerControl),
        ...(preferredWorkspacePreference ? { workspacePreference: preferredWorkspacePreference } : {}),
        ...(input.mainViewDraftTarget ? { mainViewDraft: input.mainViewDraftTarget } : {}),
        runs: input.runs,
        ...(input.activeMode ? { routingIntent: resolveModeRoutingIntent(input.activeMode) } : {}),
        modeKey: input.modeKey,
        ...(workflowRoutingTarget ? { workflowRoutingTarget } : {}),
        imageAttachmentsAllowed: input.imageAttachmentsAllowed,
        ...(input.sessionOverride ? { sessionOverride: input.sessionOverride } : {}),
    });
}

function findConversationWorkspacePreference(input: {
    workspacePreferences: RuntimeShellBootstrap['workspacePreferences'] | undefined;
    preferredWorkspaceFingerprint: string | undefined;
}) {
    if (!input.preferredWorkspaceFingerprint) {
        return undefined;
    }

    return (input.workspacePreferences ?? []).find(
        (workspacePreference) => workspacePreference.workspaceFingerprint === input.preferredWorkspaceFingerprint
    );
}
