import { okProviderService } from '@/app/backend/providers/service/errors';
import type { ProviderSyncResult } from '@/app/backend/providers/service/types';
import {
    buildProviderCatalogScopeKey,
    resolveProviderCatalogFetchState,
    type ResolvedProviderCatalogContext,
    type ResolvedProviderCatalogFetchState,
} from '@/app/backend/providers/metadata/catalogContext';
import { ProviderCatalogReadCache } from '@/app/backend/providers/metadata/providerCatalogReadCache';
import type { LogContext, ProviderCatalogRefreshReason } from '@/app/backend/providers/metadata/providerCatalogOrchestration.types';
import { logBackgroundRefreshFailure, logStaleResyncFailure } from '@/app/backend/providers/metadata/providerCatalogSyncObservability';
import { ProviderCatalogPersistenceLifecycle } from '@/app/backend/providers/metadata/providerCatalogPersistenceLifecycle';
import { ProviderCatalogScopeInvalidationService } from '@/app/backend/providers/metadata/providerCatalogScopeInvalidationService';
import type { RuntimeProviderId } from '@/app/backend/runtime/contracts';

export class ProviderCatalogSyncCoordinator {
    private readonly refreshInFlight = new Map<string, Promise<ProviderSyncResult>>();
    private readonly refreshContexts = new Map<string, ResolvedProviderCatalogContext>();
    private readonly scopeRefreshInFlight = new Map<string, Promise<ProviderSyncResult>>();

    constructor(
        private readonly readCache: ProviderCatalogReadCache,
        private readonly scopeInvalidationService: ProviderCatalogScopeInvalidationService,
        private readonly persistenceLifecycle: ProviderCatalogPersistenceLifecycle
    ) {}

    async syncSupportedCatalog(
        profileId: string,
        providerId: RuntimeProviderId,
        force: boolean,
        reason: ProviderCatalogRefreshReason,
        logContext?: LogContext,
        resolvedFetchState?: ResolvedProviderCatalogFetchState
    ): Promise<ProviderSyncResult> {
        const scopeKey = buildProviderCatalogScopeKey(profileId, providerId);
        const inFlightForScope = this.scopeRefreshInFlight.get(scopeKey);
        if (inFlightForScope) {
            return inFlightForScope;
        }

        const scopedPromise = this.runSyncSupportedCatalog(
            profileId,
            providerId,
            force,
            reason,
            logContext,
            resolvedFetchState
        );
        this.scopeRefreshInFlight.set(scopeKey, scopedPromise);

        try {
            return await scopedPromise;
        } finally {
            if (this.scopeRefreshInFlight.get(scopeKey) === scopedPromise) {
                this.scopeRefreshInFlight.delete(scopeKey);
            }
        }
    }

    private async runSyncSupportedCatalog(
        profileId: string,
        providerId: RuntimeProviderId,
        force: boolean,
        reason: ProviderCatalogRefreshReason,
        logContext?: LogContext,
        resolvedFetchState?: ResolvedProviderCatalogFetchState
    ): Promise<ProviderSyncResult> {
        const fetchStateResult = resolvedFetchState
            ? okProviderService(resolvedFetchState)
            : await resolveProviderCatalogFetchState(profileId, providerId);
        if (fetchStateResult.isErr()) {
            return {
                ok: false,
                status: 'error',
                providerId,
                reason: 'sync_failed',
                detail: fetchStateResult.error.message,
                modelCount: 0,
            };
        }

        const fetchState = fetchStateResult.value;
        const cacheKey = fetchState.context.cacheKey;
        const inFlight = this.refreshInFlight.get(cacheKey);
        if (inFlight) {
            return inFlight;
        }

        const scopeEpochAtStart = this.scopeInvalidationService.readScopeEpoch(profileId, providerId);
        const refreshPromise = this.persistenceLifecycle.executeSync({
            fetchState,
            force,
            reason,
            scopeEpochAtStart,
            ...(logContext ? { logContext } : {}),
        });

        const wrappedPromise = refreshPromise.then(async (result) => {
            if (result.disposition === 'completed' && result.persistedModels) {
                this.readCache.write(fetchState.context, result.persistedModels);
            }

            if (result.disposition === 'stale_during_persistence') {
                void this.syncSupportedCatalog(profileId, providerId, true, 'background', logContext).catch((error: unknown) => {
                    logStaleResyncFailure({
                        profileId,
                        providerId,
                        error: error instanceof Error ? error.message : String(error),
                        ...(logContext ? { logContext } : {}),
                    });
                });
            }

            return result.syncResult;
        });

        this.refreshInFlight.set(cacheKey, wrappedPromise);
        this.refreshContexts.set(cacheKey, fetchState.context);

        try {
            return await wrappedPromise;
        } finally {
            if (this.refreshInFlight.get(cacheKey) === wrappedPromise) {
                this.refreshInFlight.delete(cacheKey);
            }
            if (this.refreshContexts.get(cacheKey) === fetchState.context) {
                this.refreshContexts.delete(cacheKey);
            }
        }
    }

    scheduleBackgroundRefresh(profileId: string, providerId: RuntimeProviderId, logContext?: LogContext): void {
        void this.syncSupportedCatalog(profileId, providerId, false, 'background', logContext).catch(
            (error: unknown) => {
                logBackgroundRefreshFailure({
                    profileId,
                    providerId,
                    error: error instanceof Error ? error.message : String(error),
                    ...(logContext ? { context: logContext } : {}),
                });
            }
        );
    }

    deleteMatching(predicate: (context: ResolvedProviderCatalogContext) => boolean): void {
        for (const [cacheKey, context] of this.refreshContexts.entries()) {
            if (predicate(context)) {
                this.refreshContexts.delete(cacheKey);
                this.refreshInFlight.delete(cacheKey);
                this.scopeRefreshInFlight.delete(buildProviderCatalogScopeKey(context.profileId, context.providerId));
            }
        }
    }

    deleteScope(profileId: string, providerId: RuntimeProviderId): void {
        this.scopeRefreshInFlight.delete(buildProviderCatalogScopeKey(profileId, providerId));
    }

    clear(): void {
        this.refreshInFlight.clear();
        this.refreshContexts.clear();
        this.scopeRefreshInFlight.clear();
    }
}
