import { beforeEach, describe, expect, it, vi } from 'vitest';

const { clearModelsMock } = vi.hoisted(() => ({
    clearModelsMock: vi.fn(),
}));

vi.mock('@/app/backend/persistence/stores', () => ({
    providerCatalogStore: {
        clearModels: clearModelsMock,
    },
}));

import { ProviderCatalogReadCache } from '@/app/backend/providers/metadata/providerCatalogReadCache';
import { ProviderCatalogScopeInvalidationService } from '@/app/backend/providers/metadata/providerCatalogScopeInvalidationService';
import type { ResolvedProviderCatalogContext } from '@/app/backend/providers/metadata/catalogContext';

function createContext(overrides?: Partial<ResolvedProviderCatalogContext>): ResolvedProviderCatalogContext {
    return {
        providerId: 'openai',
        profileId: 'profile_local_default',
        authMethod: 'api_key',
        credentialFingerprint: 'credential_hash',
        organizationId: null,
        optionProfileId: 'default',
        resolvedBaseUrl: 'https://api.openai.com/v1',
        cacheKey: 'cache:openai:default',
        ...overrides,
    };
}

describe('providerCatalogScopeInvalidationService', () => {
    beforeEach(() => {
        clearModelsMock.mockReset();
    });

    it('flushes cache entries and tracked refresh contexts for the targeted scope', () => {
        const readCache = new ProviderCatalogReadCache(1_000);
        const deleteScopeMock = vi.fn();
        const deleteMatchingMock = vi.fn();
        const service = new ProviderCatalogScopeInvalidationService(readCache, {
            deleteScope: deleteScopeMock,
            deleteMatching: deleteMatchingMock,
        });

        const context = createContext();
        readCache.write(context, [] as never, 100);

        const state = service.flushScope('profile_local_default', 'openai');

        expect(state.scopeKey).toBe('profile_local_default:openai');
        expect(state.epoch).toBe(1);
        expect(service.readScopeEpoch('profile_local_default', 'openai')).toBe(1);
        expect(readCache.readFresh(context, 150)).toBeNull();
        expect(deleteScopeMock).toHaveBeenCalledWith('profile_local_default', 'openai');
        expect(deleteMatchingMock).toHaveBeenCalledTimes(1);
    });

    it('clears persisted models when a scope is invalidated', async () => {
        const service = new ProviderCatalogScopeInvalidationService(new ProviderCatalogReadCache(), {
            deleteScope: vi.fn(),
            deleteMatching: vi.fn(),
        });

        await service.invalidateScope('profile_local_default', 'kilo');

        expect(clearModelsMock).toHaveBeenCalledWith('profile_local_default', 'kilo');
    });
});
