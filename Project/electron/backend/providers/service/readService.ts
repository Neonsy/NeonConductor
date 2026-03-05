import {
    providerAuthStore,
    providerCatalogStore,
    providerStore,
    runUsageStore,
} from '@/app/backend/persistence/stores';
import type {
    OpenAISubscriptionRateLimitsSummary,
    OpenAISubscriptionUsageSummary,
    ProviderAuthStateRecord,
    ProviderModelRecord,
    ProviderUsageSummary,
} from '@/app/backend/persistence/types';
import { toProviderServiceException } from '@/app/backend/providers/service/errors';
import { defaultAuthState, ensureSupportedProvider } from '@/app/backend/providers/service/helpers';
import { getOpenAISubscriptionRateLimits as getOpenAISubscriptionRateLimitsFromWham } from '@/app/backend/providers/service/openaiSubscriptionRateLimits';
import type { ProviderListItem } from '@/app/backend/providers/service/types';
import type { RuntimeProviderId } from '@/app/backend/runtime/contracts';
import { appLog } from '@/app/main/logging';

export async function listProviders(profileId: string): Promise<ProviderListItem[]> {
    const [providers, defaults, authStates] = await Promise.all([
        providerStore.listProviders(),
        providerStore.getDefaults(profileId),
        providerAuthStore.listByProfile(profileId),
    ]);

    const authStateByProvider = new Map(authStates.map((state) => [state.providerId, state]));
    return providers.map((provider) => {
        const authState = authStateByProvider.get(provider.id) ?? defaultAuthState(profileId, provider.id);
        return {
            ...provider,
            isDefault: defaults.providerId === provider.id,
            authMethod: authState.authMethod,
            authState: authState.authState,
        };
    });
}

export async function listModels(profileId: string, providerId: RuntimeProviderId): Promise<ProviderModelRecord[]> {
    const ensuredProviderResult = await ensureSupportedProvider(providerId);
    if (ensuredProviderResult.isErr()) {
        throw toProviderServiceException(ensuredProviderResult.error);
    }

    return providerStore.listModels(profileId, ensuredProviderResult.value);
}

export async function listModelsByProfile(profileId: string): Promise<ProviderModelRecord[]> {
    return providerStore.listModelsByProfile(profileId);
}

export async function getDefaults(profileId: string): Promise<{ providerId: string; modelId: string }> {
    return providerStore.getDefaults(profileId);
}

export async function setDefault(
    profileId: string,
    providerId: RuntimeProviderId,
    modelId: string
): Promise<{
    success: boolean;
    reason: 'provider_not_found' | 'model_not_found' | null;
    defaultProviderId: string;
    defaultModelId: string;
}> {
    const ensuredProviderResult = await ensureSupportedProvider(providerId);
    if (ensuredProviderResult.isErr()) {
        const defaults = await providerStore.getDefaults(profileId);
        appLog.warn({
            tag: 'provider.read-service',
            message: 'Rejected default provider update due to unsupported or unregistered provider.',
            profileId,
            providerId,
            error: ensuredProviderResult.error.message,
        });
        return {
            success: false,
            reason: 'provider_not_found',
            defaultProviderId: defaults.providerId,
            defaultModelId: defaults.modelId,
        };
    }

    const hasModel = await providerStore.modelExists(profileId, providerId, modelId);
    if (!hasModel) {
        const defaults = await providerStore.getDefaults(profileId);
        return {
            success: false,
            reason: 'model_not_found',
            defaultProviderId: defaults.providerId,
            defaultModelId: defaults.modelId,
        };
    }

    await providerStore.setDefaults(profileId, providerId, modelId);
    const defaults = await providerStore.getDefaults(profileId);
    return {
        success: true,
        reason: null,
        defaultProviderId: defaults.providerId,
        defaultModelId: defaults.modelId,
    };
}

export async function listAuthStates(profileId: string): Promise<ProviderAuthStateRecord[]> {
    return providerAuthStore.listByProfile(profileId);
}

export async function listDiscoverySnapshots(profileId: string) {
    return providerCatalogStore.listDiscoverySnapshotsByProfile(profileId);
}

export async function listUsageSummaries(profileId: string): Promise<ProviderUsageSummary[]> {
    return runUsageStore.summarizeByProfile(profileId);
}

export async function getOpenAISubscriptionUsage(profileId: string): Promise<OpenAISubscriptionUsageSummary> {
    return runUsageStore.summarizeOpenAISubscriptionUsage(profileId);
}

export async function getOpenAISubscriptionRateLimits(profileId: string): Promise<OpenAISubscriptionRateLimitsSummary> {
    const summary = await getOpenAISubscriptionRateLimitsFromWham(profileId);
    if (summary.source === 'unavailable') {
        appLog.warn({
            tag: 'provider.openai-subscription-rate-limits',
            message: 'OpenAI subscription rate limits unavailable.',
            profileId,
            reason: summary.reason ?? null,
            detail: summary.detail ?? null,
        });
        return summary;
    }

    appLog.info({
        tag: 'provider.openai-subscription-rate-limits',
        message: 'Fetched OpenAI subscription rate limits.',
        profileId,
        limitsCount: summary.limits.length,
        hasPrimary: Boolean(summary.primary),
        hasSecondary: Boolean(summary.secondary),
    });

    return summary;
}
