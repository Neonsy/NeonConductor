import type { ProviderModelRecord } from '@/app/backend/persistence/types';
import type {
    ResolvedProviderCatalogContext,
    ResolvedProviderCatalogFetchState,
} from '@/app/backend/providers/metadata/catalogContext';
import type { ProviderSyncResult } from '@/app/backend/providers/service/types';

export interface LogContext {
    requestId?: string;
    correlationId?: string;
}

export type ProviderCatalogRefreshReason = 'manual' | 'manual_force' | 'background' | 'startup';

export interface ProviderCatalogCacheEntry {
    loadedAtMs: number;
    models: ProviderModelRecord[];
    context: ResolvedProviderCatalogContext;
}

export interface ProviderCatalogRefreshDecision {
    shouldRefresh: boolean;
    force: boolean;
    reason: ProviderCatalogRefreshReason;
}

export interface ProviderCatalogSyncContext {
    fetchState: ResolvedProviderCatalogFetchState;
    force: boolean;
    reason: ProviderCatalogRefreshReason;
    scopeEpochAtStart: number;
    logContext?: LogContext;
}

export interface ProviderCatalogPersistenceResult {
    disposition: 'completed' | 'stale_during_fetch' | 'stale_during_persistence' | 'failed';
    syncResult: ProviderSyncResult;
    persistedModels?: ProviderModelRecord[];
}

export interface ProviderCatalogScopeEpochState {
    scopeKey: string;
    epoch: number;
}
