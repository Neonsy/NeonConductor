import type { ResolvedProviderCatalogFetchState } from '@/app/backend/providers/metadata/catalogContext';
import type {
    ProviderCatalogRefreshDecision,
} from '@/app/backend/providers/metadata/providerCatalogOrchestration.types';
import type { ProviderModelRecord } from '@/app/backend/persistence/types';
import type { RuntimeProviderId } from '@/app/backend/runtime/contracts';

export function isStaticProviderId(providerId: RuntimeProviderId): providerId is Exclude<RuntimeProviderId, 'kilo'> {
    return (
        providerId === 'openai' || providerId === 'openai_codex' || providerId === 'zai' || providerId === 'moonshot'
    );
}

export class ProviderCatalogRefreshPolicy {
    private readonly startupRefreshedCatalogs = new Set<string>();

    shouldRefreshKiloOnStartup(fetchState: ResolvedProviderCatalogFetchState): boolean {
        return (
            fetchState.context.providerId === 'kilo' &&
            fetchState.context.authMethod !== 'none' &&
            fetchState.context.credentialFingerprint !== null
        );
    }

    consumeStartupRefreshDecision(
        fetchState: ResolvedProviderCatalogFetchState
    ): ProviderCatalogRefreshDecision | null {
        if (!this.shouldRefreshKiloOnStartup(fetchState)) {
            return null;
        }

        const startupRefreshKey = fetchState.context.cacheKey;
        if (this.startupRefreshedCatalogs.has(startupRefreshKey)) {
            return null;
        }

        this.startupRefreshedCatalogs.add(startupRefreshKey);
        return {
            shouldRefresh: true,
            force: true,
            reason: 'startup',
        };
    }

    shouldForceSyncForEmptyPersistedCatalog(models: ProviderModelRecord[]): boolean {
        return models.length === 0;
    }

    shouldScheduleBackgroundRefresh(): boolean {
        return true;
    }

    clear(): void {
        this.startupRefreshedCatalogs.clear();
    }
}
