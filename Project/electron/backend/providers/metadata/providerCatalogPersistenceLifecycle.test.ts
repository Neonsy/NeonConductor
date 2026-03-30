import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    fetchCatalogMock,
    replaceModelsMock,
    upsertDiscoverySnapshotMock,
    listModelsMock,
} = vi.hoisted(() => ({
    fetchCatalogMock: vi.fn(),
    replaceModelsMock: vi.fn(),
    upsertDiscoverySnapshotMock: vi.fn(),
    listModelsMock: vi.fn(),
}));

vi.mock('@/app/backend/providers/metadata/adapters', () => ({
    getProviderMetadataAdapter: vi.fn(() => ({
        fetchCatalog: fetchCatalogMock,
    })),
}));

vi.mock('@/app/backend/persistence/stores', () => ({
    providerCatalogStore: {
        replaceModels: replaceModelsMock,
        upsertDiscoverySnapshot: upsertDiscoverySnapshotMock,
    },
    providerStore: {
        listModels: listModelsMock,
    },
}));

import { ProviderCatalogPersistenceLifecycle } from '@/app/backend/providers/metadata/providerCatalogPersistenceLifecycle';
import type { ProviderCatalogSyncContext } from '@/app/backend/providers/metadata/providerCatalogOrchestration.types';

function createSyncContext(): ProviderCatalogSyncContext {
    return {
        fetchState: {
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
        },
        force: true,
        reason: 'manual_force',
        scopeEpochAtStart: 0,
    };
}

describe('providerCatalogPersistenceLifecycle', () => {
    beforeEach(() => {
        fetchCatalogMock.mockReset();
        replaceModelsMock.mockReset();
        upsertDiscoverySnapshotMock.mockReset();
        listModelsMock.mockReset();
        replaceModelsMock.mockResolvedValue({
            changed: true,
            modelCount: 1,
        });
        upsertDiscoverySnapshotMock.mockResolvedValue(undefined);
        listModelsMock.mockResolvedValue([{ id: 'kilo/model_a' }]);
    });

    it('persists normalized results, snapshots, and readback models on sync success', async () => {
        fetchCatalogMock.mockResolvedValue({
            ok: true,
            status: 'synced',
            providerId: 'kilo',
            models: [
                {
                    modelId: 'kilo/model_a',
                    label: 'Model A',
                    isFree: false,
                    features: {
                        supportsTools: true,
                        supportsReasoning: true,
                        supportsVision: false,
                        supportsAudioInput: false,
                        supportsAudioOutput: false,
                        inputModalities: ['text'],
                        outputModalities: ['text'],
                    },
                    runtime: {
                        toolProtocol: 'kilo_gateway',
                        apiFamily: 'kilo_gateway',
                        routedApiFamily: 'openai_compatible',
                    },
                    pricing: {},
                    raw: {},
                },
            ],
            providerPayload: {
                source: 'gateway',
            },
            modelPayload: {
                count: 1,
            },
        });

        const lifecycle = new ProviderCatalogPersistenceLifecycle({
            isScopeEpochCurrent: vi.fn(() => true),
        } as never);
        const result = await lifecycle.executeSync(createSyncContext());

        expect(result.disposition).toBe('completed');
        expect(result.syncResult).toEqual({
            ok: true,
            status: 'synced',
            providerId: 'kilo',
            modelCount: 1,
        });
        expect(replaceModelsMock).toHaveBeenCalledTimes(1);
        expect(upsertDiscoverySnapshotMock).toHaveBeenCalledTimes(2);
        expect(listModelsMock).toHaveBeenCalledWith('profile_local_default', 'kilo');
        expect(result.persistedModels).toEqual([{ id: 'kilo/model_a' }]);
    });

    it('fails closed and records an error snapshot when adapter fetch fails', async () => {
        fetchCatalogMock.mockResolvedValue({
            ok: false,
            status: 'error',
            providerId: 'kilo',
            reason: 'sync_failed',
            detail: 'gateway unavailable',
        });

        const lifecycle = new ProviderCatalogPersistenceLifecycle({
            isScopeEpochCurrent: vi.fn(() => true),
        } as never);
        const result = await lifecycle.executeSync(createSyncContext());

        expect(result.disposition).toBe('failed');
        expect(result.syncResult).toEqual({
            ok: false,
            status: 'error',
            providerId: 'kilo',
            reason: 'sync_failed',
            detail: 'gateway unavailable',
            modelCount: 0,
        });
        expect(upsertDiscoverySnapshotMock).toHaveBeenCalledTimes(1);
        expect(replaceModelsMock).not.toHaveBeenCalled();
    });

    it('discards stale sync results before persistence when the scope epoch changes mid-fetch', async () => {
        fetchCatalogMock.mockResolvedValue({
            ok: true,
            status: 'synced',
            providerId: 'kilo',
            models: [],
            providerPayload: {},
            modelPayload: {},
        });

        const lifecycle = new ProviderCatalogPersistenceLifecycle({
            isScopeEpochCurrent: vi.fn(() => false),
        } as never);
        const result = await lifecycle.executeSync(createSyncContext());

        expect(result.disposition).toBe('stale_during_fetch');
        expect(result.syncResult).toEqual({
            ok: true,
            status: 'unchanged',
            providerId: 'kilo',
            modelCount: 0,
        });
        expect(replaceModelsMock).not.toHaveBeenCalled();
    });

    it('discards stale persisted results when the scope epoch changes after replaceModels', async () => {
        fetchCatalogMock.mockResolvedValue({
            ok: true,
            status: 'synced',
            providerId: 'kilo',
            models: [],
            providerPayload: {},
            modelPayload: {},
        });

        const scopeInvalidationService = {
            isScopeEpochCurrent: vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false),
        };
        const lifecycle = new ProviderCatalogPersistenceLifecycle(scopeInvalidationService as never);
        const result = await lifecycle.executeSync(createSyncContext());

        expect(result.disposition).toBe('stale_during_persistence');
        expect(result.syncResult).toEqual({
            ok: true,
            status: 'unchanged',
            providerId: 'kilo',
            modelCount: 0,
        });
        expect(replaceModelsMock).toHaveBeenCalledTimes(1);
        expect(upsertDiscoverySnapshotMock).not.toHaveBeenCalled();
    });
});
