import { getProviderCatalogBehavior } from '@/app/backend/providers/behaviors';
import type { ProviderCatalogModel, ProviderCatalogSyncResult } from '@/app/backend/providers/types';

const OPENAI_MODELS_ENDPOINT = process.env['OPENAI_MODELS_ENDPOINT']?.trim() || 'https://api.openai.com/v1/models';

function createCuratedSubscriptionModel(modelId: string, label: string): ProviderCatalogModel {
    const catalogBehavior = getProviderCatalogBehavior('openai');

    return {
        modelId,
        label,
        upstreamProvider: 'openai',
        isFree: false,
        capabilities: catalogBehavior.createCapabilities({
            modelId,
            supportedParameters: ['tools', 'reasoning'],
        }),
        pricing: {},
        raw: {
            source: 'openai_subscription_curated',
        },
    };
}

const CURATED_SUBSCRIPTION_MODELS: ProviderCatalogModel[] = [
    createCuratedSubscriptionModel('openai/gpt-5', 'GPT-5'),
    createCuratedSubscriptionModel('openai/gpt-5-mini', 'GPT-5 Mini'),
    createCuratedSubscriptionModel('openai/gpt-5-codex', 'GPT-5 Codex'),
    createCuratedSubscriptionModel('openai/gpt-5.1-codex', 'GPT-5.1 Codex'),
    createCuratedSubscriptionModel('openai/gpt-5.2-codex', 'GPT-5.2 Codex'),
    createCuratedSubscriptionModel('openai/codex-mini', 'Codex Mini'),
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

export async function syncOpenAICatalog(input: {
    authMethod: 'none' | 'api_key' | 'device_code' | 'oauth_pkce' | 'oauth_device';
    apiKey?: string;
}): Promise<ProviderCatalogSyncResult> {
    const catalogBehavior = getProviderCatalogBehavior('openai');

    if (input.authMethod === 'oauth_pkce' || input.authMethod === 'oauth_device') {
        return {
            ok: true,
            status: 'synced',
            providerId: 'openai',
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
            providerId: 'openai',
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
                providerId: 'openai',
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
            const normalizedId = normalizeOpenAIId(upstreamId);

            models.push({
                modelId: normalizedId,
                label: upstreamId,
                upstreamProvider: 'openai',
                isFree: false,
                capabilities: catalogBehavior.createCapabilities({
                    modelId: normalizedId,
                }),
                pricing: {},
                raw: item,
            });
        }
        models.sort((left, right) => left.modelId.localeCompare(right.modelId));

        return {
            ok: true,
            status: 'synced',
            providerId: 'openai',
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
            providerId: 'openai',
            reason: 'sync_failed',
            detail: error instanceof Error ? error.message : String(error),
        };
    }
}
