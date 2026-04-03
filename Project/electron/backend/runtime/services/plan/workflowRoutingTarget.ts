import { providerStore } from '@/app/backend/persistence/stores';
import type { RuntimeProviderId } from '@/app/backend/runtime/contracts';
import type { PlanPlanningDepth } from '@/app/backend/runtime/contracts/types/plan';
import { getWorkspacePreference } from '@/app/backend/runtime/services/workspace/preferences';

import { resolveWorkflowRoutingPreference } from '@/shared/contracts';
import { canonicalizeProviderModelId } from '@/shared/kiloModels';
import {
    resolvePlanningWorkflowRoutingTarget,
    resolveWorkflowRoutingCompatibilityRequirements,
} from '@/shared/workflowRouting';

export interface ResolvedPlanningWorkflowRoutingTarget {
    providerId: RuntimeProviderId;
    modelId: string;
    source: 'workflow_routing' | 'workspace_preference' | 'shared_defaults' | 'compatibility_fallback';
    resolvedTargetKey: 'planning' | 'planning_advanced';
    fellBackToPlanning: boolean;
}

async function isCompatiblePlanningModel(input: {
    profileId: string;
    providerId: RuntimeProviderId;
    modelId: string;
    targetKey: 'planning' | 'planning_advanced';
}): Promise<boolean> {
    const modelCapabilities = await providerStore.getModelCapabilities(
        input.profileId,
        input.providerId,
        input.modelId
    );
    if (!modelCapabilities) {
        return false;
    }

    const compatibilityRequirements = resolveWorkflowRoutingCompatibilityRequirements(input.targetKey);
    if (compatibilityRequirements.requiresNativeTools && !modelCapabilities.features.supportsTools) {
        return false;
    }
    if (compatibilityRequirements.requiresReasoning && !modelCapabilities.features.supportsReasoning) {
        return false;
    }

    return true;
}

async function resolveCompatiblePlanningCandidate(input: {
    profileId: string;
    providerId?: RuntimeProviderId;
    modelId?: string;
    targetKey: 'planning' | 'planning_advanced';
}): Promise<{ providerId: RuntimeProviderId; modelId: string } | undefined> {
    if (!input.providerId || !input.modelId) {
        return undefined;
    }

    const modelId = canonicalizeProviderModelId(input.providerId, input.modelId);
    const compatible = await isCompatiblePlanningModel({
        profileId: input.profileId,
        providerId: input.providerId,
        modelId,
        targetKey: input.targetKey,
    });
    if (!compatible) {
        return undefined;
    }

    return {
        providerId: input.providerId,
        modelId,
    };
}

async function resolveCompatibilityFallback(input: {
    profileId: string;
    targetKey: 'planning' | 'planning_advanced';
}): Promise<{ providerId: RuntimeProviderId; modelId: string } | undefined> {
    const models = await providerStore.listModelsByProfile(input.profileId);
    const candidates = models
        .filter((model) => {
            const requirements = resolveWorkflowRoutingCompatibilityRequirements(input.targetKey);
            if (requirements.requiresNativeTools && !model.features.supportsTools) {
                return false;
            }
            if (requirements.requiresReasoning && !model.features.supportsReasoning) {
                return false;
            }

            return true;
        })
        .sort((left, right) => {
            const leftReasoning = left.features.supportsReasoning ? 1 : 0;
            const rightReasoning = right.features.supportsReasoning ? 1 : 0;
            if (leftReasoning !== rightReasoning) {
                return rightReasoning - leftReasoning;
            }

            const leftTools = left.features.supportsTools ? 1 : 0;
            const rightTools = right.features.supportsTools ? 1 : 0;
            if (leftTools !== rightTools) {
                return rightTools - leftTools;
            }

            const providerOrder = left.providerId.localeCompare(right.providerId);
            if (providerOrder !== 0) {
                return providerOrder;
            }

            return left.id.localeCompare(right.id);
        });

    const firstCandidate = candidates[0];
    if (!firstCandidate) {
        return undefined;
    }

    return {
        providerId: firstCandidate.providerId,
        modelId: canonicalizeProviderModelId(firstCandidate.providerId, firstCandidate.id),
    };
}

export async function resolvePlanningWorkflowRoutingRunTarget(input: {
    profileId: string;
    planningDepth: PlanPlanningDepth | undefined;
    workspaceFingerprint?: string;
}): Promise<ResolvedPlanningWorkflowRoutingTarget | undefined> {
    const targetKey = resolvePlanningWorkflowRoutingTarget(input.planningDepth);
    const [workflowRoutingPreferences, defaults, workspacePreference] = await Promise.all([
        providerStore.getWorkflowRoutingPreferences(input.profileId),
        providerStore.getDefaults(input.profileId),
        input.workspaceFingerprint
            ? getWorkspacePreference(input.profileId, input.workspaceFingerprint)
            : Promise.resolve(undefined),
    ]);

    const resolvedWorkflowRouting = resolveWorkflowRoutingPreference(workflowRoutingPreferences, targetKey);
    if (resolvedWorkflowRouting) {
        const workflowRoutingCandidate = await resolveCompatiblePlanningCandidate({
            profileId: input.profileId,
            providerId: resolvedWorkflowRouting.preference.providerId,
            modelId: resolvedWorkflowRouting.preference.modelId,
            targetKey,
        });
        if (workflowRoutingCandidate) {
            return {
                ...workflowRoutingCandidate,
                source: 'workflow_routing',
                resolvedTargetKey: resolvedWorkflowRouting.resolvedTargetKey,
                fellBackToPlanning: resolvedWorkflowRouting.fellBackToPlanning,
            };
        }
    }

    const workspaceCandidate = await resolveCompatiblePlanningCandidate({
        profileId: input.profileId,
        targetKey,
        ...(workspacePreference?.defaultProviderId
            ? { providerId: workspacePreference.defaultProviderId }
            : {}),
        ...(workspacePreference?.defaultModelId ? { modelId: workspacePreference.defaultModelId } : {}),
    });
    if (workspaceCandidate) {
        return {
            ...workspaceCandidate,
            source: 'workspace_preference',
            resolvedTargetKey: targetKey,
            fellBackToPlanning: false,
        };
    }

    const sharedDefaultProviderId =
        typeof defaults.providerId === 'string' ? (defaults.providerId as RuntimeProviderId) : undefined;
    const sharedDefaultsCandidate = await resolveCompatiblePlanningCandidate({
        profileId: input.profileId,
        targetKey,
        ...(sharedDefaultProviderId ? { providerId: sharedDefaultProviderId } : {}),
        ...(defaults.modelId ? { modelId: defaults.modelId } : {}),
    });
    if (sharedDefaultsCandidate) {
        return {
            ...sharedDefaultsCandidate,
            source: 'shared_defaults',
            resolvedTargetKey: targetKey,
            fellBackToPlanning: false,
        };
    }

    const compatibilityFallbackCandidate = await resolveCompatibilityFallback({
        profileId: input.profileId,
        targetKey,
    });
    if (!compatibilityFallbackCandidate) {
        return undefined;
    }

    return {
        ...compatibilityFallbackCandidate,
        source: 'compatibility_fallback',
        resolvedTargetKey: targetKey,
        fellBackToPlanning: false,
    };
}
