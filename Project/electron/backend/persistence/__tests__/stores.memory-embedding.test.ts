import { describe, expect, it } from 'vitest';

import {
    getDefaultProfileId,
    getPersistence,
    memoryEmbeddingStore,
    memoryStore,
    registerPersistenceStoreHooks,
} from '@/app/backend/persistence/__tests__/stores.shared';

registerPersistenceStoreHooks();

describe('persistence stores: memory embedding index', () => {
    it('upserts a single profile/model row per memory and keeps the latest vector', async () => {
        const profileId = getDefaultProfileId();
        const memory = await memoryStore.create({
            profileId,
            memoryType: 'semantic',
            scopeKind: 'global',
            createdByKind: 'user',
            title: 'Semantic memory',
            bodyMarkdown: 'Original body.',
        });

        const first = await memoryEmbeddingStore.upsert({
            profileId,
            memoryId: memory.id,
            providerId: 'openai',
            modelId: 'openai/text-embedding-3-small',
            sourceDigest: 'digest-1',
            indexedText: 'first text',
            embedding: [1, 0, 0],
        });
        const second = await memoryEmbeddingStore.upsert({
            profileId,
            memoryId: memory.id,
            providerId: 'openai',
            modelId: 'openai/text-embedding-3-small',
            sourceDigest: 'digest-2',
            indexedText: 'second text',
            embedding: [0, 1, 0],
        });

        const records = await memoryEmbeddingStore.listByProviderModel({
            profileId,
            providerId: 'openai',
            modelId: 'openai/text-embedding-3-small',
        });

        expect(records).toHaveLength(1);
        expect(first.id).toBe(second.id);
        expect(records[0]?.sourceDigest).toBe('digest-2');
        expect(records[0]?.embedding).toEqual([0, 1, 0]);
    });

    it('clears only the targeted provider/model slice for a profile', async () => {
        const profileId = getDefaultProfileId();
        const memory = await memoryStore.create({
            profileId,
            memoryType: 'semantic',
            scopeKind: 'global',
            createdByKind: 'user',
            title: 'Slice memory',
            bodyMarkdown: 'Slice body.',
        });

        await memoryEmbeddingStore.upsert({
            profileId,
            memoryId: memory.id,
            providerId: 'openai',
            modelId: 'openai/text-embedding-3-small',
            sourceDigest: 'small',
            indexedText: 'small text',
            embedding: [1, 0],
        });
        await memoryEmbeddingStore.upsert({
            profileId,
            memoryId: memory.id,
            providerId: 'openai',
            modelId: 'openai/text-embedding-3-large',
            sourceDigest: 'large',
            indexedText: 'large text',
            embedding: [0, 1],
        });

        await memoryEmbeddingStore.clearProfileModel({
            profileId,
            providerId: 'openai',
            modelId: 'openai/text-embedding-3-small',
        });

        expect(
            await memoryEmbeddingStore.listByProviderModel({
                profileId,
                providerId: 'openai',
                modelId: 'openai/text-embedding-3-small',
            })
        ).toEqual([]);
        expect(
            await memoryEmbeddingStore.listByProviderModel({
                profileId,
                providerId: 'openai',
                modelId: 'openai/text-embedding-3-large',
            })
        ).toHaveLength(1);
    });

    it('cascades embedding rows when the source memory is deleted', async () => {
        const profileId = getDefaultProfileId();
        const memory = await memoryStore.create({
            profileId,
            memoryType: 'semantic',
            scopeKind: 'global',
            createdByKind: 'user',
            title: 'Cascade memory',
            bodyMarkdown: 'Cascade body.',
        });

        await memoryEmbeddingStore.upsert({
            profileId,
            memoryId: memory.id,
            providerId: 'openai',
            modelId: 'openai/text-embedding-3-small',
            sourceDigest: 'cascade',
            indexedText: 'cascade text',
            embedding: [1, 0],
        });

        await getPersistence()
            .db.deleteFrom('memory_records')
            .where('profile_id', '=', profileId)
            .where('id', '=', memory.id)
            .execute();

        expect(
            await memoryEmbeddingStore.getByMemoryId({
                profileId,
                memoryId: memory.id,
                providerId: 'openai',
                modelId: 'openai/text-embedding-3-small',
            })
        ).toBeNull();
    });
});
