import { providerStore } from '@/app/backend/persistence/stores';
import type { ProviderModelRecord } from '@/app/backend/persistence/types';
import { resolveProviderCatalogFetchState } from '@/app/backend/providers/metadata/catalogContext';
import { ProviderCatalogPersistenceLifecycle } from '@/app/backend/providers/metadata/providerCatalogPersistenceLifecycle';
import { ProviderCatalogReadCache } from '@/app/backend/providers/metadata/providerCatalogReadCache';
import { ProviderCatalogRefreshPolicy, isStaticProviderId } from '@/app/backend/providers/metadata/providerCatalogRefreshPolicy';
import { ProviderCatalogScopeInvalidationService } from '@/app/backend/providers/metadata/providerCatalogScopeInvalidationService';
import { ProviderCatalogSyncCoordinator } from '@/app/backend/providers/metadata/providerCatalogSyncCoordinator';
import { logUnsupportedProviderSyncRejected } from '@/app/backend/providers/metadata/providerCatalogSyncObservability';
import type { LogContext } from '@/app/backend/providers/metadata/providerCatalogOrchestration.types';
import {
    errProviderService,
    okProviderService,
    type ProviderServiceResult,
} from '@/app/backend/providers/service/errors';
import { ensureSupportedProvider } from '@/app/backend/providers/service/helpers';
import type { ProviderSyncResult } from '@/app/backend/providers/service/types';
import type { RuntimeProviderId } from '@/app/backend/runtime/contracts';

export class ProviderMetadataOrchestrator {
    private readonly readCache: ProviderCatalogReadCache;
    private readonly refreshPolicy: ProviderCatalogRefreshPolicy;
    private readonly scopeInvalidationService: ProviderCatalogScopeInvalidationService;
    private readonly persistenceLifecycle: ProviderCatalogPersistenceLifecycle;
    private readonly syncCoordinator: ProviderCatalogSyncCoordinator;

    constructor() {
        this.readCache = new ProviderCatalogReadCache();
        this.refreshPolicy = new ProviderCatalogRefreshPolicy();

        let syncCoordinator: ProviderCatalogSyncCoordinator | null = null;
        this.scopeInvalidationService = new ProviderCatalogScopeInvalidationService(this.readCache, {
            deleteScope: (profileId, providerId) => {
                syncCoordinator?.deleteScope(profileId, providerId);
            },
            deleteMatching: (predicate) => {
                syncCoordinator?.deleteMatching(predicate);
            },
        });
        this.persistenceLifecycle = new ProviderCatalogPersistenceLifecycle(this.scopeInvalidationService);
        syncCoordinator = new ProviderCatalogSyncCoordinator(
            this.readCache,
            this.scopeInvalidationService,
            this.persistenceLifecycle
        );
        this.syncCoordinator = syncCoordinator;
    }

    async listModels(
        profileId: string,
        providerId: RuntimeProviderId
    ): Promise<ProviderServiceResult<ProviderModelRecord[]>> {
        const ensuredProviderResult = await ensureSupportedProvider(providerId);
        if (ensuredProviderResult.isErr()) {
            return errProviderService(ensuredProviderResult.error.code, ensuredProviderResult.error.message);
        }

        const supportedProviderId = ensuredProviderResult.value;
        const fetchStateResult = await resolveProviderCatalogFetchState(profileId, supportedProviderId);
        if (fetchStateResult.isErr()) {
            return errProviderService(fetchStateResult.error.code, fetchStateResult.error.message);
        }

        const fetchState = fetchStateResult.value;
        if (isStaticProviderId(supportedProviderId)) {
            await this.persistenceLifecycle.hydrateStaticCatalog(fetchState);
        }

        const startupRefreshDecision = this.refreshPolicy.consumeStartupRefreshDecision(fetchState);
        if (startupRefreshDecision) {
            await this.syncCoordinator.syncSupportedCatalog(
                fetchState.context.profileId,
                fetchState.context.providerId,
                startupRefreshDecision.force,
                startupRefreshDecision.reason,
                undefined,
                fetchState
            );
        }

        const now = Date.now();
        const cachedModels = this.readCache.readFresh(fetchState.context, now);
        if (cachedModels) {
            return okProviderService(cachedModels);
        }

        const persistedModels = await providerStore.listModels(profileId, supportedProviderId);
        if (this.refreshPolicy.shouldForceSyncForEmptyPersistedCatalog(persistedModels)) {
            const syncResult = await this.syncCoordinator.syncSupportedCatalog(
                profileId,
                supportedProviderId,
                true,
                'manual_force',
                undefined,
                fetchState
            );
            if (syncResult.ok) {
                const refreshedModels = await providerStore.listModels(profileId, supportedProviderId);
                this.readCache.write(fetchState.context, refreshedModels, now);
                return okProviderService(refreshedModels);
            }
        }

        this.readCache.write(fetchState.context, persistedModels, now);
        if (this.refreshPolicy.shouldScheduleBackgroundRefresh()) {
            this.syncCoordinator.scheduleBackgroundRefresh(profileId, supportedProviderId);
        }

        return okProviderService(persistedModels);
    }

    async listModelsByProfile(profileId: string): Promise<ProviderModelRecord[]> {
        await Promise.all(
            (['openai', 'openai_codex', 'zai', 'moonshot'] as const).map(async (providerId) => {
                const fetchStateResult = await resolveProviderCatalogFetchState(profileId, providerId);
                if (fetchStateResult.isErr()) {
                    return;
                }

                await this.persistenceLifecycle.hydrateStaticCatalog(fetchStateResult.value);
            })
        );

        const kiloFetchStateResult = await resolveProviderCatalogFetchState(profileId, 'kilo');
        if (kiloFetchStateResult.isOk()) {
            const startupRefreshDecision = this.refreshPolicy.consumeStartupRefreshDecision(kiloFetchStateResult.value);
            if (startupRefreshDecision) {
                await this.syncCoordinator.syncSupportedCatalog(
                    profileId,
                    'kilo',
                    startupRefreshDecision.force,
                    startupRefreshDecision.reason,
                    undefined,
                    kiloFetchStateResult.value
                );
            }
        }

        const models = await providerStore.listModelsByProfile(profileId);
        const byProvider = new Map<RuntimeProviderId, ProviderModelRecord[]>();

        for (const model of models) {
            const existing = byProvider.get(model.providerId) ?? [];
            existing.push(model);
            byProvider.set(model.providerId, existing);
        }

        const now = Date.now();
        for (const [providerId, providerModels] of byProvider.entries()) {
            const ensuredProviderResult = await ensureSupportedProvider(providerId);
            if (ensuredProviderResult.isErr()) {
                continue;
            }

            const fetchStateResult = await resolveProviderCatalogFetchState(profileId, ensuredProviderResult.value);
            if (fetchStateResult.isErr()) {
                continue;
            }

            this.readCache.write(fetchStateResult.value.context, providerModels, now);
        }

        return models;
    }

    async syncCatalog(
        profileId: string,
        providerId: RuntimeProviderId,
        force = false,
        context?: LogContext
    ): Promise<ProviderServiceResult<ProviderSyncResult>> {
        const ensuredProviderResult = await ensureSupportedProvider(providerId);
        if (ensuredProviderResult.isErr()) {
            logUnsupportedProviderSyncRejected({
                profileId,
                providerId,
                reason: ensuredProviderResult.error.code,
                error: ensuredProviderResult.error.message,
                ...(context ? { context } : {}),
            });
            return errProviderService(ensuredProviderResult.error.code, ensuredProviderResult.error.message);
        }

        const supportedProviderId = ensuredProviderResult.value;
        return okProviderService(
            await this.syncCoordinator.syncSupportedCatalog(
                profileId,
                supportedProviderId,
                force,
                force ? 'manual_force' : 'manual',
                context
            )
        );
    }

    async flushProviderScope(profileId: string, providerId: RuntimeProviderId): Promise<void> {
        const ensuredProviderResult = await ensureSupportedProvider(providerId);
        if (ensuredProviderResult.isErr()) {
            return;
        }

        this.scopeInvalidationService.flushScope(profileId, ensuredProviderResult.value);
    }

    async invalidateProviderScope(profileId: string, providerId: RuntimeProviderId): Promise<void> {
        const ensuredProviderResult = await ensureSupportedProvider(providerId);
        if (ensuredProviderResult.isErr()) {
            return;
        }

        await this.scopeInvalidationService.invalidateScope(profileId, ensuredProviderResult.value);
    }

    resetForTests(): void {
        this.readCache.clear();
        this.syncCoordinator.clear();
        this.scopeInvalidationService.clear();
        this.refreshPolicy.clear();
    }
}

export const providerMetadataOrchestrator = new ProviderMetadataOrchestrator();
