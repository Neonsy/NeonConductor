import { buildAutoCacheKey } from '@/app/backend/providers/behaviors/cacheKey';
import type { ProviderRuntimeBehavior } from '@/app/backend/providers/behaviors/types';
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
    modelId: string;
    runtimeOptions: RuntimeRunOptions;
}): string {
    if (input.runtimeOptions.cache.strategy === 'manual') {
        return input.runtimeOptions.cache.key ?? '';
    }

    return buildAutoCacheKey({
        profileId: input.profileId,
        sessionId: input.sessionId,
        providerId: 'kilo',
        modelId: input.modelId,
    });
}

export const kiloRuntimeBehavior: ProviderRuntimeBehavior = {
    providerId: 'kilo',
    resolveInitialTransport(runtimeOptions) {
        return {
            requested: runtimeOptions.transport.openai,
            selected: 'chat_completions',
            degraded: false,
        };
    },
    resolveCache(input) {
        const key = resolveCacheKey(input);
        if (key.trim().length === 0) {
            throw new Error('Cache key resolution failed: cache key is empty.');
        }

        return {
            strategy: input.runtimeOptions.cache.strategy,
            key,
            applied: true,
        };
    },
    validateRunOptions(input) {
        if (input.runtimeOptions.transport.openai !== 'auto') {
            throw new Error(
                `OpenAI transport override "${input.runtimeOptions.transport.openai}" is not supported for provider "kilo".`
            );
        }

        if (!input.modelCapabilities.supportsReasoning && isReasoningRequested(input.runtimeOptions)) {
            throw new Error(`Model "${input.modelId}" does not support reasoning options.`);
        }
    },
    resolveBilledVia() {
        return 'kilo_gateway';
    },
};
