import { toProviderAdapterException } from '@/app/backend/providers/adapters/errors';
import {
    buildKiloRuntimeBody,
    buildKiloRuntimeHeaders,
    resolveKiloRuntimeAuthToken,
} from '@/app/backend/providers/adapters/kilo/headers';
import { parseChatCompletionsPayload } from '@/app/backend/providers/adapters/runtimePayload';
import { KILO_GATEWAY_BASE_URL } from '@/app/backend/providers/kiloGatewayClient/constants';
import type { ProviderRuntimeHandlers, ProviderRuntimeInput } from '@/app/backend/providers/types';
import { appLog } from '@/app/main/logging';

function throwKiloRuntimeError(input: ProviderRuntimeInput, context: string, code: string, error: string): never {
    appLog.warn({
        tag: 'provider.kilo',
        message: `Kilo runtime ${context} failed.`,
        runId: input.runId,
        profileId: input.profileId,
        sessionId: input.sessionId,
        modelId: input.modelId,
        code,
        error,
    });

    throw toProviderAdapterException({
        code: 'provider_request_failed',
        message: error,
    });
}

export async function streamKiloRuntime(input: ProviderRuntimeInput, handlers: ProviderRuntimeHandlers): Promise<void> {
    const tokenResult = resolveKiloRuntimeAuthToken(input);
    if (tokenResult.isErr()) {
        throwKiloRuntimeError(input, 'auth resolution', tokenResult.error.code, tokenResult.error.message);
    }
    const token = tokenResult.value;
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

    let response: Response;
    try {
        response = await fetch(`${KILO_GATEWAY_BASE_URL}/chat/completions`, {
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
    } catch (error) {
        throwKiloRuntimeError(
            input,
            'request',
            'provider_request_unavailable',
            error instanceof Error ? error.message : 'Kilo runtime request failed before receiving a response.'
        );
    }

    if (!response.ok) {
        throwKiloRuntimeError(
            input,
            'request',
            'provider_request_failed',
            `Kilo runtime completion failed: ${String(response.status)} ${response.statusText}`
        );
    }

    const payload: unknown = await response.json();
    const parsed = parseChatCompletionsPayload(payload);
    if (parsed.isErr()) {
        throwKiloRuntimeError(input, 'payload parse', parsed.error.code, parsed.error.message);
    }

    for (const part of parsed.value.parts) {
        await handlers.onPart(part);
    }

    if (handlers.onUsage) {
        await handlers.onUsage({
            ...parsed.value.usage,
            latencyMs: Date.now() - startedAt,
        });
    }
}
