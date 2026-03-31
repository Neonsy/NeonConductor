import type { StaticEmbeddingModelDefinition } from '@/app/backend/providers/embeddingCatalog/modelDefinition';

const STATIC_SOURCE_NOTE = 'official_docs_curated_static_registry';
const STATIC_UPDATED_AT = '2026-03-31';

export const OPENAI_EMBEDDING_MODELS: StaticEmbeddingModelDefinition[] = [
    {
        providerId: 'openai',
        modelId: 'openai/text-embedding-3-small',
        label: 'Text Embedding 3 Small',
        availabilityByEndpointProfile: {
            default: true,
        },
        dimensions: 1536,
        maxInputTokens: 8191,
        sourceNote: STATIC_SOURCE_NOTE,
        updatedAt: STATIC_UPDATED_AT,
    },
    {
        providerId: 'openai',
        modelId: 'openai/text-embedding-3-large',
        label: 'Text Embedding 3 Large',
        availabilityByEndpointProfile: {
            default: true,
        },
        dimensions: 3072,
        maxInputTokens: 8191,
        sourceNote: STATIC_SOURCE_NOTE,
        updatedAt: STATIC_UPDATED_AT,
    },
    {
        providerId: 'openai',
        modelId: 'openai/text-embedding-ada-002',
        label: 'Text Embedding Ada 002',
        availabilityByEndpointProfile: {
            default: true,
        },
        dimensions: 1536,
        maxInputTokens: 8191,
        sourceNote: STATIC_SOURCE_NOTE,
        updatedAt: STATIC_UPDATED_AT,
    },
];
