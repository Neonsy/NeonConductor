import type { FirstPartyProviderId } from '@/app/backend/providers/registry';
import type {
    KiloDynamicSort,
    ProviderAuthMethod,
    RuntimeMessagePartType,
    RuntimeOpenAITransport,
    RuntimeReasoningEffort,
    RuntimeReasoningSummary,
    RuntimeRunOptions,
} from '@/app/backend/runtime/contracts';

export type ProviderModelModality = 'text' | 'audio' | 'image' | 'video' | 'pdf';

export interface ProviderModelCapabilities {
    supportsTools: boolean;
    supportsReasoning: boolean;
    supportsVision: boolean;
    supportsAudioInput: boolean;
    supportsAudioOutput: boolean;
    inputModalities: ProviderModelModality[];
    outputModalities: ProviderModelModality[];
    promptFamily?: string;
}

export interface ProviderCatalogModel {
    modelId: string;
    label: string;
    upstreamProvider?: string;
    isFree: boolean;
    capabilities: ProviderModelCapabilities;
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
    partType: RuntimeMessagePartType;
    payload: Record<string, unknown>;
}

export interface ProviderRuntimeTransportSelection {
    selected: 'responses' | 'chat_completions';
    requested: RuntimeOpenAITransport;
    degraded: boolean;
    degradedReason?: string;
}

export interface ProviderRuntimeCacheApplication {
    strategy: RuntimeRunOptions['cache']['strategy'];
    key?: string;
    applied: boolean;
    reason?: string;
}

export interface ProviderRuntimeHandlers {
    onPart: (part: ProviderRuntimePart) => Promise<void> | void;
    onUsage?: (usage: ProviderRuntimeUsage) => Promise<void> | void;
    onTransportSelected?: (selection: ProviderRuntimeTransportSelection) => Promise<void> | void;
    onCacheResolved?: (result: ProviderRuntimeCacheApplication) => Promise<void> | void;
}

export interface ProviderRuntimeReasoningOptions {
    effort: RuntimeReasoningEffort;
    summary: RuntimeReasoningSummary;
    includeEncrypted: boolean;
}

export interface ProviderRuntimeCacheOptions {
    strategy: RuntimeRunOptions['cache']['strategy'];
    key?: string;
}

export interface ProviderRuntimeTransportOptions {
    openai: RuntimeOpenAITransport;
}

export interface ProviderRuntimeInput {
    profileId: string;
    sessionId: string;
    runId: string;
    providerId: FirstPartyProviderId;
    modelId: string;
    promptText: string;
    runtimeOptions: {
        reasoning: ProviderRuntimeReasoningOptions;
        cache: ProviderRuntimeCacheOptions;
        transport: ProviderRuntimeTransportOptions;
    };
    cache: ProviderRuntimeCacheApplication;
    authMethod: ProviderAuthMethod | 'none';
    apiKey?: string;
    accessToken?: string;
    organizationId?: string;
    kiloRouting?:
        | {
              mode: 'dynamic';
              sort: KiloDynamicSort;
          }
        | {
              mode: 'pinned';
              providerId: string;
          };
    signal: AbortSignal;
}

export interface ProviderRuntimeAdapter {
    streamCompletion(input: ProviderRuntimeInput, handlers: ProviderRuntimeHandlers): Promise<void>;
}

export interface ProviderAdapter extends ProviderCatalogAdapter, ProviderRuntimeAdapter {}
