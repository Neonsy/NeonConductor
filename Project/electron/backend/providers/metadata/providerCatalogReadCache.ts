import type { ResolvedProviderCatalogContext } from '@/app/backend/providers/metadata/catalogContext';
import type {
    ProviderCatalogCacheEntry,
} from '@/app/backend/providers/metadata/providerCatalogOrchestration.types';
import type { ProviderModelRecord } from '@/app/backend/persistence/types';

const DEFAULT_METADATA_CACHE_TTL_MS = 5 * 60 * 1000;

function readMetadataCacheTtlMs(): number {
    const raw = process.env['PROVIDER_METADATA_CACHE_TTL_MS'];
    if (!raw) {
        return DEFAULT_METADATA_CACHE_TTL_MS;
    }

    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return DEFAULT_METADATA_CACHE_TTL_MS;
    }

    return parsed;
}

export class ProviderCatalogReadCache {
    private readonly cache = new Map<string, ProviderCatalogCacheEntry>();

    constructor(private readonly metadataCacheTtlMs = readMetadataCacheTtlMs()) {}

    readFresh(context: ResolvedProviderCatalogContext, now = Date.now()): ProviderModelRecord[] | null {
        const cached = this.cache.get(context.cacheKey);
        if (!cached) {
            return null;
        }

        if (now - cached.loadedAtMs > this.metadataCacheTtlMs) {
            return null;
        }

        return cached.models;
    }

    write(context: ResolvedProviderCatalogContext, models: ProviderModelRecord[], loadedAtMs = Date.now()): void {
        this.cache.set(context.cacheKey, {
            loadedAtMs,
            models,
            context,
        });
    }

    deleteMatching(predicate: (entry: ProviderCatalogCacheEntry) => boolean): void {
        for (const [cacheKey, entry] of this.cache.entries()) {
            if (predicate(entry)) {
                this.cache.delete(cacheKey);
            }
        }
    }

    clear(): void {
        this.cache.clear();
    }
}
