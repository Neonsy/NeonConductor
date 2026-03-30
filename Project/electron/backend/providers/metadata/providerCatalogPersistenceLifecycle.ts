import { providerCatalogStore, providerStore } from '@/app/backend/persistence/stores';
import { getProviderMetadataAdapter } from '@/app/backend/providers/metadata/adapters';
import type { ResolvedProviderCatalogFetchState } from '@/app/backend/providers/metadata/catalogContext';
import { normalizeCatalogMetadata, toProviderCatalogUpsert } from '@/app/backend/providers/metadata/normalize';
import type {
    ProviderCatalogPersistenceResult,
    ProviderCatalogSyncContext,
} from '@/app/backend/providers/metadata/providerCatalogOrchestration.types';
import { isStaticProviderId } from '@/app/backend/providers/metadata/providerCatalogRefreshPolicy';
import {
    logDroppedInvalidRows,
    logStaleFetchDiscarded,
    logStalePersistenceDiscarded,
    logSyncCompleted,
    logSyncFailure,
    logSyncStart,
} from '@/app/backend/providers/metadata/providerCatalogSyncObservability';
import {
    listStaticModelDefinitions,
    toStaticProviderCatalogModel,
} from '@/app/backend/providers/metadata/staticCatalog/registry';
import { ProviderCatalogScopeInvalidationService } from '@/app/backend/providers/metadata/providerCatalogScopeInvalidationService';

export class ProviderCatalogPersistenceLifecycle {
    constructor(private readonly scopeInvalidationService: ProviderCatalogScopeInvalidationService) {}

    async hydrateStaticCatalog(fetchState: ResolvedProviderCatalogFetchState): Promise<void> {
        const { context } = fetchState;
        if (!isStaticProviderId(context.providerId)) {
            return;
        }

        const models = listStaticModelDefinitions(context.providerId, context.optionProfileId).map((definition) =>
            toStaticProviderCatalogModel(definition, context.optionProfileId)
        );
        const normalized = normalizeCatalogMetadata(context.providerId, models, {
            optionProfileId: context.optionProfileId,
            resolvedBaseUrl: context.resolvedBaseUrl,
        });

        await providerCatalogStore.replaceModels(
            context.profileId,
            context.providerId,
            normalized.models.map(toProviderCatalogUpsert)
        );
    }

    async executeSync(input: ProviderCatalogSyncContext): Promise<ProviderCatalogPersistenceResult> {
        const { apiKey, accessToken } = input.fetchState;
        const resolvedContext = input.fetchState.context;
        const { profileId, providerId } = resolvedContext;

        logSyncStart({
            context: resolvedContext,
            force: input.force,
            reason: input.reason,
            ...(input.logContext ? { logContext: input.logContext } : {}),
        });

        const adapter = getProviderMetadataAdapter(providerId);
        const fetchResult = await adapter.fetchCatalog({
            profileId,
            authMethod: resolvedContext.authMethod,
            ...(apiKey ? { apiKey } : {}),
            ...(accessToken ? { accessToken } : {}),
            ...(resolvedContext.organizationId ? { organizationId: resolvedContext.organizationId } : {}),
            endpointProfile: resolvedContext.optionProfileId,
            optionProfileId: resolvedContext.optionProfileId,
            ...(resolvedContext.resolvedBaseUrl ? { resolvedBaseUrl: resolvedContext.resolvedBaseUrl } : {}),
            ...(input.force ? { force: true } : {}),
        });

        if (!fetchResult.ok) {
            await providerCatalogStore.upsertDiscoverySnapshot({
                profileId,
                providerId,
                kind: 'models',
                payload: { reason: fetchResult.reason, detail: fetchResult.detail ?? null },
                status: 'error',
            });

            logSyncFailure({
                context: resolvedContext,
                reason: fetchResult.reason,
                ...(fetchResult.detail ? { detail: fetchResult.detail } : {}),
                ...(input.logContext ? { logContext: input.logContext } : {}),
            });

            return {
                disposition: 'failed',
                syncResult: {
                    ok: false,
                    status: 'error',
                    providerId,
                    reason: fetchResult.reason,
                    ...(fetchResult.detail ? { detail: fetchResult.detail } : {}),
                    modelCount: 0,
                },
            };
        }

        if (
            !this.scopeInvalidationService.isScopeEpochCurrent(profileId, providerId, input.scopeEpochAtStart)
        ) {
            logStaleFetchDiscarded({
                context: resolvedContext,
                reason: input.reason,
                ...(input.logContext ? { logContext: input.logContext } : {}),
            });

            return {
                disposition: 'stale_during_fetch',
                syncResult: {
                    ok: true,
                    status: 'unchanged',
                    providerId,
                    modelCount: 0,
                },
            };
        }

        const normalized = normalizeCatalogMetadata(providerId, fetchResult.models, {
            optionProfileId: resolvedContext.optionProfileId,
            resolvedBaseUrl: resolvedContext.resolvedBaseUrl,
        });
        if (normalized.droppedCount > 0) {
            logDroppedInvalidRows({
                context: resolvedContext,
                droppedCount: normalized.droppedCount,
                ...(input.logContext ? { logContext: input.logContext } : {}),
            });
        }

        const replaceResult = await providerCatalogStore.replaceModels(
            profileId,
            providerId,
            normalized.models.map(toProviderCatalogUpsert)
        );

        if (
            !this.scopeInvalidationService.isScopeEpochCurrent(profileId, providerId, input.scopeEpochAtStart)
        ) {
            logStalePersistenceDiscarded({
                context: resolvedContext,
                reason: input.reason,
                ...(input.logContext ? { logContext: input.logContext } : {}),
            });

            return {
                disposition: 'stale_during_persistence',
                syncResult: {
                    ok: true,
                    status: 'unchanged',
                    providerId,
                    modelCount: 0,
                },
            };
        }

        await Promise.all([
            providerCatalogStore.upsertDiscoverySnapshot({
                profileId,
                providerId,
                kind: 'models',
                payload: fetchResult.modelPayload,
                status: 'ok',
            }),
            providerCatalogStore.upsertDiscoverySnapshot({
                profileId,
                providerId,
                kind: 'providers',
                payload: fetchResult.providerPayload,
                status: 'ok',
            }),
        ]);

        const persistedModels = await providerStore.listModels(profileId, providerId);
        const syncResult = {
            ok: true,
            status: replaceResult.changed ? 'synced' : 'unchanged',
            providerId,
            modelCount: replaceResult.modelCount,
        } as const;

        logSyncCompleted({
            context: resolvedContext,
            result: syncResult,
            overrideCount: normalized.overrideCount,
            derivedCount: normalized.derivedCount,
            droppedCount: normalized.droppedCount,
            ...(input.logContext ? { logContext: input.logContext } : {}),
        });

        return {
            disposition: 'completed',
            syncResult,
            persistedModels,
        };
    }
}
