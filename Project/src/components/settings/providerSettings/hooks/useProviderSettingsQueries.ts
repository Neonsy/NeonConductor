import { PROGRESSIVE_QUERY_OPTIONS } from '@/web/lib/query/progressiveQueryOptions';
import { trpc } from '@/web/trpc/client';

import type { RuntimeProviderId } from '@/shared/contracts';

interface UseProviderSettingsQueriesInput {
    profileId: string;
    selectedProviderId: RuntimeProviderId | undefined;
    selectedModelId: string;
}

export function useProviderSettingsQueries(input: UseProviderSettingsQueriesInput) {
    const providersQuery = trpc.provider.listProviders.useQuery(
        { profileId: input.profileId },
        PROGRESSIVE_QUERY_OPTIONS
    );
    const defaultsQuery = trpc.provider.getDefaults.useQuery(
        { profileId: input.profileId },
        PROGRESSIVE_QUERY_OPTIONS
    );

    const listModelsQuery = trpc.provider.listModels.useQuery(
        {
            profileId: input.profileId,
            providerId: input.selectedProviderId ?? 'openai',
        },
        {
            enabled: Boolean(input.selectedProviderId),
            ...PROGRESSIVE_QUERY_OPTIONS,
        }
    );

    const authStateQuery = trpc.provider.getAuthState.useQuery(
        {
            profileId: input.profileId,
            providerId: input.selectedProviderId ?? 'openai',
        },
        {
            enabled: Boolean(input.selectedProviderId),
            ...PROGRESSIVE_QUERY_OPTIONS,
        }
    );

    const kiloRoutingPreferenceQuery = trpc.provider.getModelRoutingPreference.useQuery(
        {
            profileId: input.profileId,
            providerId: 'kilo',
            modelId: input.selectedModelId,
        },
        {
            enabled: input.selectedProviderId === 'kilo' && input.selectedModelId.trim().length > 0,
            ...PROGRESSIVE_QUERY_OPTIONS,
        }
    );

    const kiloModelProvidersQuery = trpc.provider.listModelProviders.useQuery(
        {
            profileId: input.profileId,
            providerId: 'kilo',
            modelId: input.selectedModelId,
        },
        {
            enabled: input.selectedProviderId === 'kilo' && input.selectedModelId.trim().length > 0,
            ...PROGRESSIVE_QUERY_OPTIONS,
        }
    );

    const accountContextQuery = trpc.provider.getAccountContext.useQuery(
        {
            profileId: input.profileId,
            providerId: input.selectedProviderId ?? 'kilo',
        },
        {
            enabled: input.selectedProviderId === 'kilo',
            ...PROGRESSIVE_QUERY_OPTIONS,
        }
    );

    const usageSummaryQuery = trpc.provider.getUsageSummary.useQuery(
        {
            profileId: input.profileId,
        },
        {
            enabled: Boolean(input.selectedProviderId),
            ...PROGRESSIVE_QUERY_OPTIONS,
        }
    );

    const openAISubscriptionUsageQuery = trpc.provider.getOpenAISubscriptionUsage.useQuery(
        {
            profileId: input.profileId,
        },
        {
            enabled: input.selectedProviderId === 'openai',
            ...PROGRESSIVE_QUERY_OPTIONS,
        }
    );

    const openAISubscriptionRateLimitsQuery = trpc.provider.getOpenAISubscriptionRateLimits.useQuery(
        {
            profileId: input.profileId,
        },
        {
            enabled: input.selectedProviderId === 'openai',
            ...PROGRESSIVE_QUERY_OPTIONS,
        }
    );

    return {
        providersQuery,
        defaultsQuery,
        listModelsQuery,
        authStateQuery,
        kiloRoutingPreferenceQuery,
        kiloModelProvidersQuery,
        accountContextQuery,
        usageSummaryQuery,
        openAISubscriptionUsageQuery,
        openAISubscriptionRateLimitsQuery,
    };
}

