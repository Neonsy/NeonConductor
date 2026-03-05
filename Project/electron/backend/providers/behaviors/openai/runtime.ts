import { buildAutoCacheKey } from '@/app/backend/providers/behaviors/cacheKey';
import {
    errProviderBehavior,
    okProviderBehavior,
    type ProviderRuntimeBehavior,
} from '@/app/backend/providers/behaviors/types';
import type { RuntimeRunOptions } from '@/app/backend/runtime/contracts';

function isReasoningRequested(runtimeOptions: RuntimeRunOptions): boolean {
    return (
        runtimeOptions.reasoning.effort !== 'none' ||
        runtimeOptions.reasoning.summary !== 'none' ||
        runtimeOptions.reasoning.includeEncrypted
    );
}

function resolveCacheKey(input: {
    profileId: string;
    sessionId: string;
    cacheScopeKey?: string;
    modelId: string;
    runtimeOptions: RuntimeRunOptions;
}): string {
    if (input.runtimeOptions.cache.strategy === 'manual') {
        return input.runtimeOptions.cache.key ?? '';
    }

    return buildAutoCacheKey({
        profileId: input.profileId,
        scopeKey: input.cacheScopeKey ?? input.sessionId,
        providerId: 'openai',
        modelId: input.modelId,
    });
}

export const openAIRuntimeBehavior: ProviderRuntimeBehavior = {
    providerId: 'openai',
    resolveInitialTransport(runtimeOptions) {
        if (runtimeOptions.transport.openai === 'chat') {
            return {
                requested: runtimeOptions.transport.openai,
                selected: 'chat_completions',
                degraded: false,
            };
        }

        return {
            requested: runtimeOptions.transport.openai,
            selected: 'responses',
            degraded: false,
        };
    },
    resolveCache(input) {
        const key = resolveCacheKey(input);
        if (key.trim().length === 0) {
            return errProviderBehavior('cache_key_invalid', 'Cache key resolution failed: cache key is empty.');
        }

        return okProviderBehavior({
            strategy: input.runtimeOptions.cache.strategy,
            key,
            applied: false,
            reason: 'unsupported_transport',
        });
    },
    validateRunOptions(input) {
        if (!input.modelCapabilities.supportsReasoning && isReasoningRequested(input.runtimeOptions)) {
            return errProviderBehavior(
                'runtime_option_invalid',
                `Model "${input.modelId}" does not support reasoning options.`
            );
        }

        return okProviderBehavior(undefined);
    },
    resolveBilledVia(authMethod) {
        if (authMethod === 'api_key') {
            return 'openai_api';
        }

        return 'openai_subscription';
    },
};
