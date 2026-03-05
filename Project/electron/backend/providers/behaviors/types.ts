import { err, ok, type Result } from 'neverthrow';

import type { FirstPartyProviderId } from '@/app/backend/providers/registry';
import type { ProviderModelCapabilities } from '@/app/backend/providers/types';
import type { ProviderAuthMethod, RuntimeRunOptions } from '@/app/backend/runtime/contracts';
import type { RunCacheResolution, RunTransportResolution } from '@/app/backend/runtime/services/runExecution/types';

export type ProviderBilledVia = 'kilo_gateway' | 'openai_api' | 'openai_subscription';

export interface ProviderRuntimeCacheInput {
    profileId: string;
    sessionId: string;
    cacheScopeKey?: string;
    modelId: string;
    runtimeOptions: RuntimeRunOptions;
}

export interface ProviderRuntimeValidationInput {
    modelId: string;
    modelCapabilities: ProviderModelCapabilities;
    runtimeOptions: RuntimeRunOptions;
}

export type ProviderBehaviorErrorCode = 'cache_key_invalid' | 'runtime_option_invalid';

export interface ProviderBehaviorError {
    code: ProviderBehaviorErrorCode;
    message: string;
}

export type ProviderBehaviorResult<T> = Result<T, ProviderBehaviorError>;

export function okProviderBehavior<T>(value: T): ProviderBehaviorResult<T> {
    return ok(value);
}

export function errProviderBehavior(code: ProviderBehaviorErrorCode, message: string): ProviderBehaviorResult<never> {
    return err({
        code,
        message,
    });
}

export interface ProviderRuntimeBehavior {
    readonly providerId: FirstPartyProviderId;
    resolveInitialTransport(runtimeOptions: RuntimeRunOptions): RunTransportResolution;
    resolveCache(input: ProviderRuntimeCacheInput): ProviderBehaviorResult<RunCacheResolution>;
    validateRunOptions(input: ProviderRuntimeValidationInput): ProviderBehaviorResult<void>;
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
