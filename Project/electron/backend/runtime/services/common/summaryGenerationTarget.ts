import { contextPolicyService } from '@/app/backend/runtime/services/context/policyService';
import { estimatePreparedContextMessages } from '@/app/backend/runtime/services/context/sessionContextBudgetEvaluator';
import { utilityModelService } from '@/app/backend/runtime/services/profile/utilityModel';
import type { RuntimeProviderId } from '@/app/backend/runtime/contracts';
import type { RunContextMessage } from '@/app/backend/runtime/services/runExecution/types';

export interface ResolvedSummaryGenerationTarget {
    providerId: RuntimeProviderId;
    modelId: string;
    source: 'utility' | 'fallback';
}

async function canModelFitMessages(input: {
    profileId: string;
    providerId: RuntimeProviderId;
    modelId: string;
    messages: RunContextMessage[];
}): Promise<boolean> {
    const policy = await contextPolicyService.resolvePolicy({
        profileId: input.profileId,
        providerId: input.providerId,
        modelId: input.modelId,
    });
    if (!policy.limits.modelLimitsKnown || !policy.usableInputBudgetTokens || policy.disabledReason) {
        return false;
    }

    const estimate = await estimatePreparedContextMessages({
        profileId: input.profileId,
        policy,
        messages: input.messages,
    });

    return !!estimate.estimate && estimate.estimate.totalTokens <= policy.usableInputBudgetTokens;
}

export async function resolveSummaryGenerationTarget(input: {
    profileId: string;
    fallbackProviderId: RuntimeProviderId;
    fallbackModelId: string;
    summaryMessages: RunContextMessage[];
    requireFallbackFit?: boolean;
}): Promise<ResolvedSummaryGenerationTarget | null> {
    const target = await utilityModelService.resolveUtilityModelTarget({
        profileId: input.profileId,
        fallbackProviderId: input.fallbackProviderId,
        fallbackModelId: input.fallbackModelId,
    });

    if (
        target.source === 'utility' &&
        (await canModelFitMessages({
            profileId: input.profileId,
            providerId: target.providerId,
            modelId: target.modelId,
            messages: input.summaryMessages,
        }))
    ) {
        return target;
    }

    if (input.requireFallbackFit) {
        const fallbackFits = await canModelFitMessages({
            profileId: input.profileId,
            providerId: input.fallbackProviderId,
            modelId: input.fallbackModelId,
            messages: input.summaryMessages,
        });

        return fallbackFits
            ? {
                  providerId: input.fallbackProviderId,
                  modelId: input.fallbackModelId,
                  source: 'fallback',
              }
            : null;
    }

    return {
        providerId: input.fallbackProviderId,
        modelId: input.fallbackModelId,
        source: 'fallback',
    };
}
