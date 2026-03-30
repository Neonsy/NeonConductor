import { providerCatalogStore } from '@/app/backend/persistence/stores';
import { buildProviderCatalogScopeKey, type ResolvedProviderCatalogContext } from '@/app/backend/providers/metadata/catalogContext';
import { ProviderCatalogReadCache } from '@/app/backend/providers/metadata/providerCatalogReadCache';
import type { ProviderCatalogScopeEpochState } from '@/app/backend/providers/metadata/providerCatalogOrchestration.types';
import type { RuntimeProviderId } from '@/app/backend/runtime/contracts';

interface RefreshTrackingStore {
    deleteScope(profileId: string, providerId: RuntimeProviderId): void;
    deleteMatching(predicate: (context: ResolvedProviderCatalogContext) => boolean): void;
}

export class ProviderCatalogScopeInvalidationService {
    private readonly scopeEpochs = new Map<string, number>();

    constructor(
        private readonly readCache: ProviderCatalogReadCache,
        private readonly refreshTrackingStore: RefreshTrackingStore
    ) {}

    readScopeEpoch(profileId: string, providerId: RuntimeProviderId): number {
        return this.scopeEpochs.get(buildProviderCatalogScopeKey(profileId, providerId)) ?? 0;
    }

    isScopeEpochCurrent(profileId: string, providerId: RuntimeProviderId, expectedEpoch: number): boolean {
        return this.readScopeEpoch(profileId, providerId) === expectedEpoch;
    }

    flushScope(profileId: string, providerId: RuntimeProviderId): ProviderCatalogScopeEpochState {
        const scopeKey = buildProviderCatalogScopeKey(profileId, providerId);
        const currentEpoch = this.scopeEpochs.get(scopeKey) ?? 0;
        const nextEpoch = currentEpoch + 1;
        this.scopeEpochs.set(scopeKey, nextEpoch);

        this.readCache.deleteMatching(
            (entry) => entry.context.profileId === profileId && entry.context.providerId === providerId
        );
        this.refreshTrackingStore.deleteScope(profileId, providerId);
        this.refreshTrackingStore.deleteMatching(
            (context) => context.profileId === profileId && context.providerId === providerId
        );

        return {
            scopeKey,
            epoch: nextEpoch,
        };
    }

    async invalidateScope(profileId: string, providerId: RuntimeProviderId): Promise<ProviderCatalogScopeEpochState> {
        const nextState = this.flushScope(profileId, providerId);
        await providerCatalogStore.clearModels(profileId, providerId);
        return nextState;
    }

    clear(): void {
        this.scopeEpochs.clear();
    }
}
