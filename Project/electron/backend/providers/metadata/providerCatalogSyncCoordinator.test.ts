import { beforeEach, describe, expect, it, vi } from 'vitest';

const { resolveProviderCatalogFetchStateMock } = vi.hoisted(() => ({
    resolveProviderCatalogFetchStateMock: vi.fn(),
}));

vi.mock('@/app/backend/providers/metadata/catalogContext', () => ({
    buildProviderCatalogScopeKey: vi.fn((profileId: string, providerId: string) => `${profileId}:${providerId}`),
    resolveProviderCatalogFetchState: resolveProviderCatalogFetchStateMock,
}));

import { okProviderService, errProviderService } from '@/app/backend/providers/service/errors';
import type { ProviderCatalogPersistenceResult } from '@/app/backend/providers/metadata/providerCatalogOrchestration.types';
import { ProviderCatalogReadCache } from '@/app/backend/providers/metadata/providerCatalogReadCache';
import { ProviderCatalogSyncCoordinator } from '@/app/backend/providers/metadata/providerCatalogSyncCoordinator';

describe('providerCatalogSyncCoordinator', () => {
    beforeEach(() => {
        resolveProviderCatalogFetchStateMock.mockReset();
    });

    it('coalesces concurrent sync requests for the same cache key', async () => {
        let finishPersistence: ((value: ProviderCatalogPersistenceResult) => void) | undefined;
        resolveProviderCatalogFetchStateMock.mockResolvedValue(
            okProviderService({
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
            })
        );

        const executeSync = vi.fn(
            () =>
                new Promise<ProviderCatalogPersistenceResult>((resolve) => {
                    finishPersistence = resolve;
                })
        );
        const coordinator = new ProviderCatalogSyncCoordinator(
            new ProviderCatalogReadCache(),
            {
                readScopeEpoch: vi.fn(() => 0),
            } as never,
            {
                executeSync,
            } as never
        );

        const first = coordinator.syncSupportedCatalog('profile_local_default', 'kilo', true, 'manual_force');
        const second = coordinator.syncSupportedCatalog('profile_local_default', 'kilo', true, 'manual_force');
        await Promise.resolve();
        await Promise.resolve();
        if (!finishPersistence) {
            throw new Error('Expected executeSync to be in flight before resolving persistence.');
        }

        finishPersistence({
            disposition: 'completed',
            syncResult: {
                ok: true,
                status: 'synced',
                providerId: 'kilo',
                modelCount: 1,
            },
            persistedModels: [
                {
                    id: 'kilo/model_a',
                    providerId: 'kilo',
                    label: 'Kilo Model A',
                    features: {
                        supportsTools: true,
                        supportsReasoning: false,
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
                },
            ],
        });

        const results = await Promise.all([first, second]);

        expect(executeSync).toHaveBeenCalledTimes(1);
        expect(results).toEqual([
            {
                ok: true,
                status: 'synced',
                providerId: 'kilo',
                modelCount: 1,
            },
            {
                ok: true,
                status: 'synced',
                providerId: 'kilo',
                modelCount: 1,
            },
        ]);
    });

    it('returns sync_failed when fetch-state resolution fails', async () => {
        resolveProviderCatalogFetchStateMock.mockResolvedValue(
            errProviderService('request_failed', 'fetch state failed')
        );

        const coordinator = new ProviderCatalogSyncCoordinator(
            new ProviderCatalogReadCache(),
            {
                readScopeEpoch: vi.fn(() => 0),
            } as never,
            {
                executeSync: vi.fn(),
            } as never
        );

        const result = await coordinator.syncSupportedCatalog('profile_local_default', 'kilo', true, 'manual_force');

        expect(result).toEqual({
            ok: false,
            status: 'error',
            providerId: 'kilo',
            reason: 'sync_failed',
            detail: 'fetch state failed',
            modelCount: 0,
        });
    });
});
