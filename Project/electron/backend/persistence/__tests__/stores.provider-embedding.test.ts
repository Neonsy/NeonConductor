import { describe, expect, it } from 'vitest';

import {
    getDefaultProfileId,
    profileStore,
    providerEmbeddingCatalogStore,
    registerPersistenceStoreHooks,
} from '@/app/backend/persistence/__tests__/stores.shared';

registerPersistenceStoreHooks();

describe('persistence stores: provider embedding catalog', () => {
    it('seeds OpenAI embedding models and copies them on profile duplication', async () => {
        const profileId = getDefaultProfileId();
        const seededModels = await providerEmbeddingCatalogStore.listModels(profileId, 'openai');
        expect(seededModels.length).toBeGreaterThan(0);
        expect(seededModels[0]?.id).toContain('openai/');
        expect(seededModels[0]?.dimensions).toBeGreaterThan(0);

        const duplicateResult = await profileStore.duplicate(profileId, 'Embedding Copy');
        expect(duplicateResult.isOk()).toBe(true);
        if (duplicateResult.isErr() || !duplicateResult.value) {
            throw new Error(duplicateResult.isErr() ? duplicateResult.error.message : 'Expected duplicated profile.');
        }

        const copiedModels = await providerEmbeddingCatalogStore.listModels(duplicateResult.value.id, 'openai');
        expect(
            copiedModels.map((model) => ({
                id: model.id,
                providerId: model.providerId,
                label: model.label,
                dimensions: model.dimensions,
                maxInputTokens: model.maxInputTokens,
                inputPrice: model.inputPrice,
                source: model.source,
                raw: model.raw,
            }))
        ).toEqual(
            seededModels.map((model) => ({
                id: model.id,
                providerId: model.providerId,
                label: model.label,
                dimensions: model.dimensions,
                maxInputTokens: model.maxInputTokens,
                inputPrice: model.inputPrice,
                source: model.source,
                raw: model.raw,
            }))
        );
    });
});
