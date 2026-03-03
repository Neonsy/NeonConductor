import {
    buildKiloRuntimeBody,
    buildKiloRuntimeHeaders,
    resolveKiloRuntimeAuthToken,
} from '@/app/backend/providers/adapters/kilo/headers';
import { parseChatCompletionsPayload } from '@/app/backend/providers/adapters/runtimePayload';
import { KILO_GATEWAY_BASE_URL } from '@/app/backend/providers/kiloGatewayClient/constants';
import type { ProviderRuntimeHandlers, ProviderRuntimeInput } from '@/app/backend/providers/types';

export async function streamKiloRuntime(input: ProviderRuntimeInput, handlers: ProviderRuntimeHandlers): Promise<void> {
    const token = resolveKiloRuntimeAuthToken(input);
    const startedAt = Date.now();

    if (handlers.onTransportSelected) {
        await handlers.onTransportSelected({
            selected: 'chat_completions',
            requested: input.runtimeOptions.transport.openai,
            degraded: false,
        });
    }
    if (handlers.onCacheResolved) {
        await handlers.onCacheResolved(input.cache);
    }

    const response = await fetch(`${KILO_GATEWAY_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: buildKiloRuntimeHeaders({
            token,
            ...(input.organizationId ? { organizationId: input.organizationId } : {}),
            modelId: input.modelId,
            ...(input.cache.applied && input.cache.key
                ? {
                      cacheKey: input.cache.key,
                  }
                : {}),
        }),
        body: JSON.stringify(buildKiloRuntimeBody(input)),
        signal: input.signal,
    });

    if (!response.ok) {
        throw new Error(`Kilo runtime completion failed: ${String(response.status)} ${response.statusText}`);
    }

    const payload: unknown = await response.json();
    const parsed = parseChatCompletionsPayload(payload);

    for (const part of parsed.parts) {
        await handlers.onPart(part);
    }

    if (handlers.onUsage) {
        await handlers.onUsage({
            ...parsed.usage,
            latencyMs: Date.now() - startedAt,
        });
    }
}
