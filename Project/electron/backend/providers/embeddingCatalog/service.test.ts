import { describe, expect, it } from 'vitest';

import { getDefaultProfileId, registerPersistenceStoreHooks } from '@/app/backend/persistence/__tests__/stores.shared';
import { providerEmbeddingCatalogService } from '@/app/backend/providers/embeddingCatalog/service';

registerPersistenceStoreHooks();

describe('providerEmbeddingCatalogService', () => {
    it('returns an embedding control plane snapshot for seeded OpenAI models', async () => {
        const profileId = getDefaultProfileId();
        const result = await providerEmbeddingCatalogService.getControlPlane(profileId);
        expect(result.isOk()).toBe(true);
        if (result.isErr()) {
            throw new Error(result.error.message);
        }

        expect(result.value.entries).toHaveLength(1);
        expect(result.value.entries[0]?.provider.id).toBe('openai');
        expect(result.value.entries[0]?.models.length).toBeGreaterThan(0);
    });
});
