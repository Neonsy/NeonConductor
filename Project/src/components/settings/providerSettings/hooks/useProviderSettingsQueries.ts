import { trpc } from '@/web/trpc/client';

import type { RuntimeProviderId } from '@/app/backend/runtime/contracts';

interface UseProviderSettingsQueriesInput {
    profileId: string;
    selectedProviderId: RuntimeProviderId | undefined;
    selectedModelId: string;
}

export function useProviderSettingsQueries(input: UseProviderSettingsQueriesInput) {
    const providersQuery = trpc.provider.listProviders.useQuery(
        { profileId: input.profileId },
        { refetchOnWindowFocus: false }
    );
    const defaultsQuery = trpc.provider.getDefaults.useQuery(
        { profileId: input.profileId },
        { refetchOnWindowFocus: false }
    );

    const listModelsQuery = trpc.provider.listModels.useQuery(
        {
            profileId: input.profileId,
            providerId: input.selectedProviderId ?? 'openai',
        },
        {
            enabled: Boolean(input.selectedProviderId),
            refetchOnWindowFocus: false,
        }
    );

    const authStateQuery = trpc.provider.getAuthState.useQuery(
        {
            profileId: input.profileId,
            providerId: input.selectedProviderId ?? 'openai',
        },
        {
            enabled: Boolean(input.selectedProviderId),
            refetchOnWindowFocus: false,
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
            refetchOnWindowFocus: false,
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
            refetchOnWindowFocus: false,
        }
    );

    const accountContextQuery = trpc.provider.getAccountContext.useQuery(
        {
            profileId: input.profileId,
            providerId: input.selectedProviderId ?? 'kilo',
        },
        {
            enabled: input.selectedProviderId === 'kilo',
            refetchOnWindowFocus: false,
        }
    );

    const usageSummaryQuery = trpc.provider.getUsageSummary.useQuery(
        {
            profileId: input.profileId,
        },
        {
            enabled: Boolean(input.selectedProviderId),
            refetchOnWindowFocus: false,
        }
    );

    const openAISubscriptionUsageQuery = trpc.provider.getOpenAISubscriptionUsage.useQuery(
        {
            profileId: input.profileId,
        },
        {
            enabled: input.selectedProviderId === 'openai',
            refetchOnWindowFocus: false,
        }
    );

    const openAISubscriptionRateLimitsQuery = trpc.provider.getOpenAISubscriptionRateLimits.useQuery(
        {
            profileId: input.profileId,
        },
        {
            enabled: input.selectedProviderId === 'openai',
            refetchOnWindowFocus: false,
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
