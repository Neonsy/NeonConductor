import type { StaticEmbeddingModelDefinition } from '@/app/backend/providers/embeddingCatalog/modelDefinition';
import { OPENAI_EMBEDDING_MODELS } from '@/app/backend/providers/embeddingCatalog/staticCatalog/openai';
import type { FirstPartyProviderId } from '@/app/backend/providers/registry';
import type { ProviderEmbeddingModelRecord } from '@/app/backend/persistence/types';

const staticRegistry: Record<Exclude<FirstPartyProviderId, 'kilo'>, StaticEmbeddingModelDefinition[]> = {
    openai: OPENAI_EMBEDDING_MODELS,
    openai_codex: [],
    zai: [],
    moonshot: [],
};

function isAvailableForEndpoint(model: StaticEmbeddingModelDefinition, endpointProfile: string): boolean {
    return model.availabilityByEndpointProfile[endpointProfile] === true;
}

export function listStaticEmbeddingModelDefinitions(
    providerId: Exclude<FirstPartyProviderId, 'kilo'>,
    endpointProfile: string
): StaticEmbeddingModelDefinition[] {
    const source = staticRegistry[providerId];
    return source
        .filter((model) => isAvailableForEndpoint(model, endpointProfile))
        .slice()
        .sort((left, right) => left.label.localeCompare(right.label));
}

export function toStaticProviderEmbeddingCatalogModel(
    definition: StaticEmbeddingModelDefinition,
    endpointProfile: string
): ProviderEmbeddingModelRecord {
    return {
        id: definition.modelId,
        providerId: definition.providerId,
        label: definition.label,
        dimensions: definition.dimensions,
        ...(definition.maxInputTokens !== undefined ? { maxInputTokens: definition.maxInputTokens } : {}),
        ...(definition.inputPrice !== undefined ? { inputPrice: definition.inputPrice } : {}),
        source: definition.sourceNote,
        updatedAt: definition.updatedAt,
        raw: {
            source: definition.sourceNote,
            updatedAt: definition.updatedAt,
            endpointProfile,
        },
    };
}
