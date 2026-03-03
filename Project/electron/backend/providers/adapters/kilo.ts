import { parseChatCompletionsPayload } from '@/app/backend/providers/adapters/runtimePayload';
import { kiloGatewayClient } from '@/app/backend/providers/kiloGatewayClient';
import { KILO_GATEWAY_BASE_URL } from '@/app/backend/providers/kiloGatewayClient/constants';
import {
    DEFAULT_CLIENT_VERSION,
    DEFAULT_EDITOR_NAME,
    HEADER_EDITOR_NAME,
    HEADER_MODE,
    HEADER_ORGANIZATION_ID,
} from '@/app/backend/providers/kiloGatewayClient/constants';
import type {
    ProviderAdapter,
    ProviderCatalogModel,
    ProviderCatalogSyncResult,
    ProviderRuntimeHandlers,
    ProviderRuntimeInput,
} from '@/app/backend/providers/types';

function buildModelsByProviderIndex(
    payload: Array<{ providerId: string; modelIds: string[] }>
): Map<string, Set<string>> {
    const index = new Map<string, Set<string>>();
    for (const entry of payload) {
        index.set(entry.providerId, new Set(entry.modelIds));
    }

    return index;
}

function normalizeKiloModel(input: {
    id: string;
    name: string;
    upstreamProvider?: string;
    contextLength?: number;
    supportedParameters: string[];
    pricing: Record<string, unknown>;
    raw: Record<string, unknown>;
}): ProviderCatalogModel {
    const supportsTools = input.supportedParameters.includes('tools');
    const supportsReasoning = input.supportedParameters.includes('reasoning');

    return {
        modelId: input.id,
        label: input.name,
        ...(input.upstreamProvider ? { upstreamProvider: input.upstreamProvider } : {}),
        isFree: input.id.endsWith(':free'),
        supportsTools,
        supportsReasoning,
        ...(input.contextLength !== undefined ? { contextLength: input.contextLength } : {}),
        pricing: input.pricing,
        raw: input.raw,
    };
}

function resolveAuthToken(input: ProviderRuntimeInput): string {
    const token = input.accessToken ?? input.apiKey;
    if (!token) {
        throw new Error('Kilo runtime execution requires access token or API key.');
    }

    return token;
}

function buildRuntimeHeaders(input: {
    token: string;
    organizationId?: string;
    modelId: string;
}): Record<string, string> {
    const headers: Record<string, string> = {
        Authorization: `Bearer ${input.token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'neonconductor-gateway-client',
        [HEADER_EDITOR_NAME]: DEFAULT_EDITOR_NAME,
        'X-NeonConductor-Client-Version': DEFAULT_CLIENT_VERSION,
    };

    if (input.organizationId) {
        headers[HEADER_ORGANIZATION_ID] = input.organizationId;
    }

    if (input.modelId === 'kilo/auto') {
        headers[HEADER_MODE] = 'code';
    }

    return headers;
}

export class KiloProviderAdapter implements ProviderAdapter {
    readonly id = 'kilo' as const;

    async syncCatalog(input: {
        profileId: string;
        authMethod: 'none' | 'api_key' | 'device_code' | 'oauth_pkce' | 'oauth_device';
        apiKey?: string;
        accessToken?: string;
        organizationId?: string;
        force?: boolean;
    }): Promise<ProviderCatalogSyncResult> {
        const accessToken = input.apiKey ?? input.accessToken;

        if (!accessToken) {
            return {
                ok: false,
                status: 'error',
                providerId: this.id,
                reason: 'auth_required',
                detail: 'Kilo sync requires an access token.',
            };
        }

        try {
            const requestHeaders = {
                accessToken,
                ...(input.organizationId ? { organizationId: input.organizationId } : {}),
            };

            const [models, providers, modelsByProvider] = await Promise.all([
                kiloGatewayClient.getModels(requestHeaders),
                kiloGatewayClient.getProviders(requestHeaders),
                kiloGatewayClient.getModelsByProvider(requestHeaders).catch(() => []),
            ]);

            const modelsByProviderIndex = buildModelsByProviderIndex(modelsByProvider);
            const normalizedModels = models.map((model) => {
                const entry = normalizeKiloModel(model);
                if (entry.upstreamProvider && modelsByProviderIndex.has(entry.upstreamProvider)) {
                    const hasMembership =
                        modelsByProviderIndex.get(entry.upstreamProvider)?.has(entry.modelId) ?? false;
                    return {
                        ...entry,
                        raw: {
                            ...entry.raw,
                            modelsByProviderMembership: hasMembership,
                        },
                    };
                }

                return entry;
            });

            return {
                ok: true,
                status: 'synced',
                providerId: this.id,
                models: normalizedModels,
                providerPayload: {
                    providers,
                    modelsByProvider,
                },
                modelPayload: {
                    models,
                },
            };
        } catch (error) {
            return {
                ok: false,
                status: 'error',
                providerId: this.id,
                reason: 'sync_failed',
                detail: error instanceof Error ? error.message : String(error),
            };
        }
    }

    async streamCompletion(input: ProviderRuntimeInput, handlers: ProviderRuntimeHandlers): Promise<void> {
        const token = resolveAuthToken(input);
        const startedAt = Date.now();

        const response = await fetch(`${KILO_GATEWAY_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: buildRuntimeHeaders({
                token,
                ...(input.organizationId ? { organizationId: input.organizationId } : {}),
                modelId: input.modelId,
            }),
            body: JSON.stringify({
                model: input.modelId,
                messages: [
                    {
                        role: 'user',
                        content: input.prompt,
                    },
                ],
                stream: false,
                stream_options: {
                    include_usage: true,
                },
            }),
            signal: input.signal,
        });

        if (!response.ok) {
            throw new Error(`Kilo runtime completion failed: ${String(response.status)} ${response.statusText}`);
        }

        const payload: unknown = await response.json();
        const parsed = parseChatCompletionsPayload(payload);

        if (parsed.text.length > 0) {
            await handlers.onPart({
                partType: 'text',
                payload: {
                    text: parsed.text,
                },
            });
        }

        if (handlers.onUsage) {
            await handlers.onUsage({
                ...parsed.usage,
                latencyMs: Date.now() - startedAt,
            });
        }
    }
}

export const kiloProviderAdapter = new KiloProviderAdapter();
