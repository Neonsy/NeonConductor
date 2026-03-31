import { getProviderAdapter } from '@/app/backend/providers/adapters';
import { providerStore } from '@/app/backend/persistence/stores';
import type { ProviderRuntimeInput, ProviderRuntimePart } from '@/app/backend/providers/types';
import type { RuntimeProviderId } from '@/app/backend/runtime/contracts';
import { createEntityId } from '@/app/backend/runtime/identity/entityIds';
import { errOp, okOp, type OperationalResult } from '@/app/backend/runtime/services/common/operationalError';
import type { RunContextMessage } from '@/app/backend/runtime/services/runExecution/types';
import { resolveRuntimeProtocol } from '@/app/backend/runtime/services/runExecution/protocol';
import { resolveRunAuth } from '@/app/backend/runtime/services/runExecution/resolveRunAuth';

function toProviderContextMessages(
    messages: RunContextMessage[]
): NonNullable<ProviderRuntimeInput['contextMessages']> {
    return messages.map((message) => ({
        role: message.role,
        parts: message.parts.flatMap((part) =>
            part.type === 'text'
                ? [
                      {
                          type: 'text' as const,
                          text: part.text,
                      },
                  ]
                : []
        ),
    }));
}

function readTextPart(part: ProviderRuntimePart): string | null {
    if (part.partType !== 'text' && part.partType !== 'reasoning_summary') {
        return null;
    }

    const text = part.payload['text'];
    return typeof text === 'string' && text.trim().length > 0 ? text : null;
}

export async function generatePlainTextFromMessages(input: {
    profileId: string;
    providerId: RuntimeProviderId;
    modelId: string;
    messages: RunContextMessage[];
    promptText?: string;
    timeoutMs?: number;
}): Promise<OperationalResult<string>> {
    const authResult = await resolveRunAuth({
        profileId: input.profileId,
        providerId: input.providerId,
    });
    if (authResult.isErr()) {
        return errOp(authResult.error.code, authResult.error.message);
    }

    const modelCapabilities = await providerStore.getModelCapabilities(input.profileId, input.providerId, input.modelId);
    if (!modelCapabilities) {
        return errOp('provider_model_missing', `Model "${input.modelId}" is missing runtime capabilities.`);
    }

    const runtimeOptions = {
        reasoning: {
            effort: 'none' as const,
            summary: 'none' as const,
            includeEncrypted: false,
        },
        cache: {
            strategy: 'auto' as const,
        },
        transport: {
            family: 'auto' as const,
        },
        execution: {},
    };

    const runtimeProtocol = await resolveRuntimeProtocol({
        profileId: input.profileId,
        providerId: input.providerId,
        modelId: input.modelId,
        modelCapabilities,
        authMethod: authResult.value.authMethod,
        runtimeOptions,
    });
    if (runtimeProtocol.isErr()) {
        return errOp(runtimeProtocol.error.code, runtimeProtocol.error.message);
    }

    const adapter = getProviderAdapter(input.providerId);
    const controller = new AbortController();
    const timeout = setTimeout(() => {
        controller.abort();
    }, input.timeoutMs ?? 10_000);

    let generatedText = '';

    try {
        const result = await adapter.streamCompletion(
            {
                profileId: input.profileId,
                sessionId: createEntityId('sess'),
                runId: createEntityId('run'),
                providerId: input.providerId,
                modelId: input.modelId,
                runtime: runtimeProtocol.value.runtime,
                promptText: input.promptText ?? '',
                contextMessages: toProviderContextMessages(input.messages),
                runtimeOptions,
                cache: {
                    strategy: 'auto',
                    applied: false,
                },
                authMethod: authResult.value.authMethod,
                ...(authResult.value.apiKey ? { apiKey: authResult.value.apiKey } : {}),
                ...(authResult.value.accessToken ? { accessToken: authResult.value.accessToken } : {}),
                ...(authResult.value.organizationId ? { organizationId: authResult.value.organizationId } : {}),
                signal: controller.signal,
            },
            {
                onPart: (part) => {
                    const text = readTextPart(part);
                    if (text) {
                        generatedText += text;
                    }
                },
            }
        );
        if (result.isErr()) {
            return errOp(result.error.code, result.error.message);
        }
    } catch (error) {
        return errOp(
            'provider_request_failed',
            error instanceof Error ? error.message : 'Plain-text generation failed unexpectedly.'
        );
    } finally {
        clearTimeout(timeout);
    }

    const normalizedText = generatedText.trim();
    if (normalizedText.length === 0) {
        return errOp('provider_request_failed', 'Plain-text generation returned an empty response.');
    }

    return okOp(normalizedText);
}
