import { parseChatCompletionsPayload, parseResponsesPayload } from '@/app/backend/providers/adapters/runtimePayload';
import type {
    ProviderAdapter,
    ProviderCatalogModel,
    ProviderCatalogSyncResult,
    ProviderRuntimeHandlers,
    ProviderRuntimeInput,
} from '@/app/backend/providers/types';

const OPENAI_MODELS_ENDPOINT = process.env['OPENAI_MODELS_ENDPOINT']?.trim() || 'https://api.openai.com/v1/models';
const OPENAI_CHAT_COMPLETIONS_ENDPOINT =
    process.env['OPENAI_CHAT_COMPLETIONS_ENDPOINT']?.trim() || 'https://api.openai.com/v1/chat/completions';
const OPENAI_RESPONSES_ENDPOINT =
    process.env['OPENAI_RESPONSES_ENDPOINT']?.trim() || 'https://api.openai.com/v1/responses';

const CURATED_SUBSCRIPTION_MODELS: ProviderCatalogModel[] = [
    {
        modelId: 'openai/gpt-5',
        label: 'GPT-5',
        upstreamProvider: 'openai',
        isFree: false,
        supportsTools: true,
        supportsReasoning: true,
        pricing: {},
        raw: {
            source: 'openai_subscription_curated',
        },
    },
    {
        modelId: 'openai/gpt-5-mini',
        label: 'GPT-5 Mini',
        upstreamProvider: 'openai',
        isFree: false,
        supportsTools: true,
        supportsReasoning: true,
        pricing: {},
        raw: {
            source: 'openai_subscription_curated',
        },
    },
];

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readOptionalString(value: unknown): string | undefined {
    if (typeof value !== 'string') {
        return undefined;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
}

function normalizeOpenAIId(rawId: string): string {
    return rawId.startsWith('openai/') ? rawId : `openai/${rawId}`;
}

function toUpstreamModelId(modelId: string): string {
    return modelId.startsWith('openai/') ? modelId.slice('openai/'.length) : modelId;
}

function resolveAuthToken(input: ProviderRuntimeInput): string {
    const token = input.accessToken ?? input.apiKey;
    if (!token) {
        throw new Error('OpenAI runtime execution requires API key or OAuth access token.');
    }

    return token;
}

async function emitCompletion(
    parsed: { text: string; usage: Record<string, number | undefined> },
    handlers: ProviderRuntimeHandlers,
    startedAt: number
): Promise<void> {
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

export class OpenAIProviderAdapter implements ProviderAdapter {
    readonly id = 'openai' as const;

    async syncCatalog(input: {
        profileId: string;
        authMethod: 'none' | 'api_key' | 'device_code' | 'oauth_pkce' | 'oauth_device';
        apiKey?: string;
        accessToken?: string;
        organizationId?: string;
        force?: boolean;
    }): Promise<ProviderCatalogSyncResult> {
        if (input.authMethod === 'oauth_pkce' || input.authMethod === 'oauth_device') {
            return {
                ok: true,
                status: 'synced',
                providerId: this.id,
                models: CURATED_SUBSCRIPTION_MODELS,
                providerPayload: {
                    source: 'openai_subscription_curated',
                },
                modelPayload: {
                    source: 'openai_subscription_curated',
                    modelIds: CURATED_SUBSCRIPTION_MODELS.map((model) => model.modelId),
                },
            };
        }

        if (!input.apiKey) {
            return {
                ok: false,
                status: 'error',
                providerId: this.id,
                reason: 'auth_required',
                detail: 'OpenAI catalog sync requires API key or OAuth auth.',
            };
        }

        try {
            const response = await fetch(OPENAI_MODELS_ENDPOINT, {
                headers: {
                    Authorization: `Bearer ${input.apiKey}`,
                    Accept: 'application/json',
                },
                signal: AbortSignal.timeout(15_000),
            });

            if (!response.ok) {
                return {
                    ok: false,
                    status: 'error',
                    providerId: this.id,
                    reason: 'sync_failed',
                    detail: `OpenAI models request failed: ${String(response.status)} ${response.statusText}`,
                };
            }

            const payload = (await response.json()) as unknown;
            const data = isRecord(payload) && Array.isArray(payload['data']) ? payload['data'] : [];

            const models: ProviderCatalogModel[] = [];
            for (const item of data) {
                if (!isRecord(item)) {
                    continue;
                }

                const upstreamId = readOptionalString(item['id']);
                if (!upstreamId) {
                    continue;
                }

                models.push({
                    modelId: normalizeOpenAIId(upstreamId),
                    label: upstreamId,
                    upstreamProvider: 'openai',
                    isFree: false,
                    supportsTools: true,
                    supportsReasoning: true,
                    pricing: {},
                    raw: item,
                });
            }
            models.sort((left, right) => left.modelId.localeCompare(right.modelId));

            return {
                ok: true,
                status: 'synced',
                providerId: this.id,
                models,
                providerPayload: {
                    source: 'openai_api',
                },
                modelPayload: isRecord(payload) ? payload : {},
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
        const model = toUpstreamModelId(input.modelId);

        const chatResponse = await fetch(OPENAI_CHAT_COMPLETIONS_ENDPOINT, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model,
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

        if (chatResponse.ok) {
            const payload: unknown = await chatResponse.json();
            const parsed = parseChatCompletionsPayload(payload);
            await emitCompletion(parsed, handlers, startedAt);
            return;
        }

        if (chatResponse.status !== 404) {
            throw new Error(`OpenAI chat completion failed: ${String(chatResponse.status)} ${chatResponse.statusText}`);
        }

        const responsesResult = await fetch(OPENAI_RESPONSES_ENDPOINT, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model,
                input: [
                    {
                        role: 'user',
                        content: input.prompt,
                    },
                ],
            }),
            signal: input.signal,
        });

        if (!responsesResult.ok) {
            throw new Error(
                `OpenAI responses completion failed: ${String(responsesResult.status)} ${responsesResult.statusText}`
            );
        }

        const payload: unknown = await responsesResult.json();
        const parsed = parseResponsesPayload(payload);
        await emitCompletion(parsed, handlers, startedAt);
    }
}

export const openAIProviderAdapter = new OpenAIProviderAdapter();
