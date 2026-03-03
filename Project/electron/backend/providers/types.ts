import type { FirstPartyProviderId } from '@/app/backend/providers/registry';
import type { ProviderAuthMethod } from '@/app/backend/runtime/contracts';

export interface ProviderCatalogModel {
    modelId: string;
    label: string;
    upstreamProvider?: string;
    isFree: boolean;
    supportsTools: boolean;
    supportsReasoning: boolean;
    contextLength?: number;
    pricing: Record<string, unknown>;
    raw: Record<string, unknown>;
}

export interface ProviderCatalogSyncSuccess {
    ok: true;
    status: 'synced' | 'unchanged';
    providerId: FirstPartyProviderId;
    models: ProviderCatalogModel[];
    providerPayload: Record<string, unknown>;
    modelPayload: Record<string, unknown>;
}

export interface ProviderCatalogSyncFailure {
    ok: false;
    status: 'error';
    providerId: FirstPartyProviderId;
    reason: 'auth_required' | 'sync_failed';
    detail?: string;
}

export type ProviderCatalogSyncResult = ProviderCatalogSyncSuccess | ProviderCatalogSyncFailure;

export interface ProviderCatalogAdapter {
    readonly id: FirstPartyProviderId;
    syncCatalog(input: {
        profileId: string;
        authMethod: ProviderAuthMethod | 'none';
        apiKey?: string;
        accessToken?: string;
        organizationId?: string;
        force?: boolean;
    }): Promise<ProviderCatalogSyncResult>;
}

export interface ProviderRuntimeUsage {
    inputTokens?: number;
    outputTokens?: number;
    cachedTokens?: number;
    reasoningTokens?: number;
    totalTokens?: number;
    latencyMs?: number;
    costMicrounits?: number;
}

export interface ProviderRuntimePart {
    partType: 'text' | 'tool_call' | 'error' | 'status';
    payload: Record<string, unknown>;
}

export interface ProviderRuntimeHandlers {
    onPart: (part: ProviderRuntimePart) => Promise<void> | void;
    onUsage?: (usage: ProviderRuntimeUsage) => Promise<void> | void;
}

export interface ProviderRuntimeInput {
    profileId: string;
    modelId: string;
    prompt: string;
    authMethod: ProviderAuthMethod | 'none';
    apiKey?: string;
    accessToken?: string;
    organizationId?: string;
    signal: AbortSignal;
}

export interface ProviderRuntimeAdapter {
    streamCompletion(input: ProviderRuntimeInput, handlers: ProviderRuntimeHandlers): Promise<void>;
}

export interface ProviderAdapter extends ProviderCatalogAdapter, ProviderRuntimeAdapter {}
