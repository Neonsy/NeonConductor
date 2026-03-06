import { describe, expect, it, vi } from 'vitest';

import { createProviderSettingsRefetchers } from '@/web/components/settings/providerSettings/hooks/providerSettingsRefetch';

function createRefetchSpy() {
    return {
        refetch: vi.fn().mockResolvedValue(undefined),
    };
}

describe('providerSettingsRefetch', () => {
    it('creates narrow grouped refetch callbacks for provider settings queries', () => {
        const providersQuery = createRefetchSpy();
        const defaultsQuery = createRefetchSpy();
        const authStateQuery = createRefetchSpy();
        const listModelsQuery = createRefetchSpy();
        const kiloRoutingPreferenceQuery = createRefetchSpy();
        const kiloModelProvidersQuery = createRefetchSpy();
        const accountContextQuery = createRefetchSpy();
        const openAISubscriptionRateLimitsQuery = createRefetchSpy();

        const refetchers = createProviderSettingsRefetchers({
            providersQuery,
            defaultsQuery,
            authStateQuery,
            listModelsQuery,
            kiloRoutingPreferenceQuery,
            kiloModelProvidersQuery,
            accountContextQuery,
            openAISubscriptionRateLimitsQuery,
        });

        refetchers.refetchProviders();
        refetchers.refetchDefaults();
        refetchers.refetchAuthState();
        refetchers.refetchListModels();
        refetchers.refetchKiloRoutingPreference();
        refetchers.refetchKiloModelProviders();
        refetchers.refetchAccountContext();
        refetchers.refetchOpenAIRateLimits();

        expect(providersQuery.refetch).toHaveBeenCalledTimes(1);
        expect(defaultsQuery.refetch).toHaveBeenCalledTimes(1);
        expect(authStateQuery.refetch).toHaveBeenCalledTimes(1);
        expect(listModelsQuery.refetch).toHaveBeenCalledTimes(1);
        expect(kiloRoutingPreferenceQuery.refetch).toHaveBeenCalledTimes(1);
        expect(kiloModelProvidersQuery.refetch).toHaveBeenCalledTimes(1);
        expect(accountContextQuery.refetch).toHaveBeenCalledTimes(1);
        expect(openAISubscriptionRateLimitsQuery.refetch).toHaveBeenCalledTimes(1);
    });
});
