import { syncOpenAIEmbeddingCatalog } from '@/app/backend/providers/embeddingCatalog/adapters/openai';
import { assertSupportedProviderId } from '@/app/backend/providers/registry';
import type { FirstPartyProviderId } from '@/app/backend/providers/registry';

export type EmbeddingCatalogAdapter = {
    readonly id: FirstPartyProviderId;
    syncCatalog(input: {
        profileId: string;
        endpointProfile?: string;
    }): Promise<Awaited<ReturnType<typeof syncOpenAIEmbeddingCatalog>>>;
};

const adapters: Partial<Record<FirstPartyProviderId, EmbeddingCatalogAdapter>> = {
    openai: {
        id: 'openai',
        syncCatalog(input) {
            return syncOpenAIEmbeddingCatalog(input);
        },
    },
};

export function getEmbeddingCatalogAdapter(providerId: FirstPartyProviderId): EmbeddingCatalogAdapter | null {
    const supported = assertSupportedProviderId(providerId);
    return adapters[supported] ?? null;
}
