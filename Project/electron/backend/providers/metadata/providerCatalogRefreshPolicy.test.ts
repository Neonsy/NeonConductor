import { describe, expect, it } from 'vitest';

import { ProviderCatalogRefreshPolicy, isStaticProviderId } from '@/app/backend/providers/metadata/providerCatalogRefreshPolicy';
import type { ResolvedProviderCatalogFetchState } from '@/app/backend/providers/metadata/catalogContext';

function createFetchState(overrides?: Partial<ResolvedProviderCatalogFetchState>): ResolvedProviderCatalogFetchState {
    return {
        context: {
            providerId: 'kilo',
            profileId: 'profile_local_default',
            authMethod: 'api_key',
            credentialFingerprint: 'credential_hash',
            organizationId: null,
            optionProfileId: 'gateway',
            resolvedBaseUrl: 'https://api.kilo.ai',
            cacheKey: 'cache:kilo:gateway',
        },
        apiKey: 'test-key',
        ...overrides,
    };
}

describe('providerCatalogRefreshPolicy', () => {
    it('allows startup Kilo refresh only once per credentialed cache scope', () => {
        const policy = new ProviderCatalogRefreshPolicy();
        const fetchState = createFetchState();

        expect(policy.consumeStartupRefreshDecision(fetchState)).toEqual({
            shouldRefresh: true,
            force: true,
            reason: 'startup',
        });
        expect(policy.consumeStartupRefreshDecision(fetchState)).toBeNull();
    });

    it('does not run startup refresh for unauthenticated or non-Kilo catalogs', () => {
        const policy = new ProviderCatalogRefreshPolicy();
        const unauthenticatedFetchState = createFetchState({
            context: {
                ...createFetchState().context,
                authMethod: 'none',
            },
        });
        delete unauthenticatedFetchState.apiKey;

        expect(
            policy.consumeStartupRefreshDecision(unauthenticatedFetchState)
        ).toBeNull();

        expect(
            policy.consumeStartupRefreshDecision(
                createFetchState({
                    context: {
                        ...createFetchState().context,
                        providerId: 'openai',
                        resolvedBaseUrl: 'https://api.openai.com/v1',
                        cacheKey: 'cache:openai:default',
                    },
                })
            )
        ).toBeNull();
    });

    it('treats empty persisted catalogs as a force-sync condition', () => {
        const policy = new ProviderCatalogRefreshPolicy();

        expect(policy.shouldForceSyncForEmptyPersistedCatalog([])).toBe(true);
        expect(policy.shouldForceSyncForEmptyPersistedCatalog([{} as never])).toBe(false);
    });

    it('keeps static-provider classification stable', () => {
        expect(isStaticProviderId('openai')).toBe(true);
        expect(isStaticProviderId('kilo')).toBe(false);
    });
});
