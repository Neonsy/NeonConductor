import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    listModelsMock,
    listModelsByProfileMock,
    replaceModelsMock,
    clearModelsMock,
    upsertDiscoverySnapshotMock,
    resolveProviderCatalogFetchStateMock,
    ensureSupportedProviderMock,
    fetchCatalogMock,
} = vi.hoisted(() => ({
    listModelsMock: vi.fn(),
    listModelsByProfileMock: vi.fn(),
    replaceModelsMock: vi.fn(),
    clearModelsMock: vi.fn(),
    upsertDiscoverySnapshotMock: vi.fn(),
    resolveProviderCatalogFetchStateMock: vi.fn(),
    ensureSupportedProviderMock: vi.fn(),
    fetchCatalogMock: vi.fn(),
}));

vi.mock('@/app/backend/persistence/stores', () => ({
    providerStore: {
        listModels: listModelsMock,
        listModelsByProfile: listModelsByProfileMock,
    },
    providerCatalogStore: {
        replaceModels: replaceModelsMock,
        clearModels: clearModelsMock,
        upsertDiscoverySnapshot: upsertDiscoverySnapshotMock,
    },
}));

vi.mock('@/app/backend/providers/metadata/catalogContext', () => ({
    buildProviderCatalogScopeKey: vi.fn((profileId: string, providerId: string) => `${profileId}:${providerId}`),
    resolveProviderCatalogFetchState: resolveProviderCatalogFetchStateMock,
}));

vi.mock('@/app/backend/providers/service/helpers', () => ({
    ensureSupportedProvider: ensureSupportedProviderMock,
}));

vi.mock('@/app/backend/providers/metadata/adapters', () => ({
    getProviderMetadataAdapter: vi.fn(() => ({
        fetchCatalog: fetchCatalogMock,
    })),
}));

import { okProviderService } from '@/app/backend/providers/service/errors';
import { ProviderMetadataOrchestrator } from '@/app/backend/providers/metadata/orchestrator';

function createFetchState(providerId: 'openai' | 'kilo') {
    return {
        context: {
            providerId,
            profileId: 'profile_local_default',
            authMethod: providerId === 'kilo' ? 'api_key' : 'none',
            credentialFingerprint: providerId === 'kilo' ? 'credential_hash' : null,
            organizationId: null,
            optionProfileId: providerId === 'kilo' ? 'gateway' : 'default',
            resolvedBaseUrl: providerId === 'kilo' ? 'https://api.kilo.ai' : 'https://api.openai.com/v1',
            cacheKey: `cache:${providerId}`,
        },
        ...(providerId === 'kilo' ? { apiKey: 'test-key' } : {}),
    };
}

describe('providerMetadataOrchestrator', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        ensureSupportedProviderMock.mockImplementation(async (providerId: string) => okProviderService(providerId));
        replaceModelsMock.mockResolvedValue({
            changed: true,
            modelCount: 1,
        });
        clearModelsMock.mockResolvedValue(undefined);
        upsertDiscoverySnapshotMock.mockResolvedValue(undefined);
        listModelsMock.mockResolvedValue([]);
        listModelsByProfileMock.mockResolvedValue([]);
        fetchCatalogMock.mockResolvedValue({
            ok: true,
            status: 'synced',
            providerId: 'kilo',
            models: [],
            providerPayload: {},
            modelPayload: {},
        });
    });

    it('hydrates static provider catalogs before listing persisted models', async () => {
        resolveProviderCatalogFetchStateMock.mockResolvedValue(okProviderService(createFetchState('openai')));
        listModelsMock.mockResolvedValue([
            {
                id: 'openai/gpt-5',
            },
        ]);

        const orchestrator = new ProviderMetadataOrchestrator();
        const result = await orchestrator.listModels('profile_local_default', 'openai');
        const replaceCallOrder = replaceModelsMock.mock.invocationCallOrder[0];
        const listCallOrder = listModelsMock.mock.invocationCallOrder[0];

        if (replaceCallOrder === undefined || listCallOrder === undefined) {
            throw new Error('Expected replaceModels and listModels to be called.');
        }

        expect(result.isOk()).toBe(true);
        expect(replaceModelsMock).toHaveBeenCalled();
        expect(listModelsMock).toHaveBeenCalledWith('profile_local_default', 'openai');
        expect(replaceCallOrder).toBeLessThan(listCallOrder);
    });

    it('runs startup Kilo refresh only once per credentialed catalog scope', async () => {
        resolveProviderCatalogFetchStateMock.mockResolvedValue(okProviderService(createFetchState('kilo')));

        const orchestrator = new ProviderMetadataOrchestrator();
        await orchestrator.listModelsByProfile('profile_local_default');
        await orchestrator.listModelsByProfile('profile_local_default');

        expect(fetchCatalogMock).toHaveBeenCalledTimes(1);
    });

    it('invalidates persisted provider models through the public scope API', async () => {
        const orchestrator = new ProviderMetadataOrchestrator();

        await orchestrator.invalidateProviderScope('profile_local_default', 'openai');

        expect(clearModelsMock).toHaveBeenCalledWith('profile_local_default', 'openai');
    });
});
