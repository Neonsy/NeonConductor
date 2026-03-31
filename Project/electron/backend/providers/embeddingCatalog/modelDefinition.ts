import type { FirstPartyProviderId } from '@/app/backend/providers/registry';

export interface StaticEmbeddingModelDefinition {
    providerId: Exclude<FirstPartyProviderId, 'kilo'>;
    modelId: string;
    label: string;
    availabilityByEndpointProfile: Record<string, boolean>;
    dimensions: number;
    maxInputTokens?: number;
    inputPrice?: number;
    sourceNote: string;
    updatedAt: string;
}
