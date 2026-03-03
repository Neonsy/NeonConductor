import type { FirstPartyProviderId } from '@/app/backend/providers/registry';
import type { ProviderModelCapabilities } from '@/app/backend/providers/types';
import type { ProviderAuthMethod, RuntimeRunOptions } from '@/app/backend/runtime/contracts';
import type { RunCacheResolution, RunTransportResolution } from '@/app/backend/runtime/services/runExecution/types';

export type ProviderBilledVia = 'kilo_gateway' | 'openai_api' | 'openai_subscription';

export interface ProviderRuntimeCacheInput {
    profileId: string;
    sessionId: string;
    modelId: string;
    runtimeOptions: RuntimeRunOptions;
}

export interface ProviderRuntimeValidationInput {
    modelId: string;
    modelCapabilities: ProviderModelCapabilities;
    runtimeOptions: RuntimeRunOptions;
}

export interface ProviderRuntimeBehavior {
    readonly providerId: FirstPartyProviderId;
    resolveInitialTransport(runtimeOptions: RuntimeRunOptions): RunTransportResolution;
    resolveCache(input: ProviderRuntimeCacheInput): RunCacheResolution;
    validateRunOptions(input: ProviderRuntimeValidationInput): void;
    resolveBilledVia(authMethod: ProviderAuthMethod | 'none'): ProviderBilledVia;
}

export interface ProviderCatalogCapabilityInput {
    modelId: string;
    supportedParameters?: string[];
    inputModalities?: string[];
    outputModalities?: string[];
    promptFamily?: string;
}

export interface ProviderCatalogBehavior {
    readonly providerId: FirstPartyProviderId;
    createCapabilities(input: ProviderCatalogCapabilityInput): ProviderModelCapabilities;
}
