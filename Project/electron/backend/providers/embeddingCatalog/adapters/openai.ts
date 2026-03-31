import { resolveOpenAIEndpoints, resolveOpenAIEndpointsFromBaseUrl } from '@/app/backend/providers/adapters/openai/endpoints';
import { resolveProviderRuntimePathContext } from '@/app/backend/providers/runtimePathContext';
import { resolveSecret } from '@/app/backend/providers/service/helpers';
import {
    errEmbeddingCatalogAdapter,
    okEmbeddingCatalogAdapter,
    type EmbeddingCatalogAdapterResult,
} from '@/app/backend/providers/embeddingCatalog/adapters/errors';
import {
    listStaticEmbeddingModelDefinitions,
    toStaticProviderEmbeddingCatalogModel,
} from '@/app/backend/providers/embeddingCatalog/staticCatalog/registry';
import type { ProviderEmbeddingModelRecord } from '@/app/backend/persistence/types';

export interface ProviderEmbeddingCatalogFetchResult {
    ok: true;
    status: 'synced' | 'unchanged';
    providerId: 'openai';
    models: ProviderEmbeddingModelRecord[];
    providerPayload: Record<string, unknown>;
    modelPayload: Record<string, unknown>;
}

export type ProviderEmbeddingCatalogResult = EmbeddingCatalogAdapterResult<ProviderEmbeddingCatalogFetchResult>;

export async function syncOpenAIEmbeddingCatalog(input: {
    profileId: string;
    endpointProfile?: string;
}): Promise<ProviderEmbeddingCatalogResult> {
    const runtimePathResult = await resolveProviderRuntimePathContext(input.profileId, 'openai');
    if (runtimePathResult.isErr()) {
        return errEmbeddingCatalogAdapter('provider_request_unavailable', runtimePathResult.error.message);
    }

    const apiKey = await resolveSecret(input.profileId, 'openai', 'api_key');
    const accessToken = await resolveSecret(input.profileId, 'openai', 'access_token');
    if (!apiKey && !accessToken) {
        return errEmbeddingCatalogAdapter('auth_missing', 'OpenAI authentication is required to read embedding models.');
    }

    const endpointProfile = input.endpointProfile ?? runtimePathResult.value.optionProfileId ?? 'default';
    const endpoint = runtimePathResult.value.resolvedBaseUrl
        ? resolveOpenAIEndpointsFromBaseUrl(runtimePathResult.value.resolvedBaseUrl)
        : resolveOpenAIEndpoints();

    const definitions = listStaticEmbeddingModelDefinitions('openai', endpointProfile);
    const models = definitions.map((definition) => toStaticProviderEmbeddingCatalogModel(definition, endpointProfile));

    return okEmbeddingCatalogAdapter({
        ok: true,
        status: 'synced',
        providerId: 'openai',
        models,
        providerPayload: {
            source: 'static_embedding_registry',
            providerId: 'openai',
            endpointProfile,
            baseUrl: endpoint.baseUrl,
        },
        modelPayload: {
            source: 'static_embedding_registry',
            count: models.length,
            endpointProfile,
            modelIds: models.map((model) => model.id),
        },
    });
}
