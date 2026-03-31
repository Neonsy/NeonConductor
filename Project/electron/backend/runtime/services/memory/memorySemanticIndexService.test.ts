import { beforeEach, describe, expect, it, vi } from 'vitest';

import { okOp } from '@/app/backend/runtime/services/common/operationalError';

const { resolveSecretMock, getConnectionProfileStateMock } = vi.hoisted(() => ({
    resolveSecretMock: vi.fn(),
    getConnectionProfileStateMock: vi.fn(),
}));

vi.mock('@/app/backend/providers/service/helpers', () => ({
    resolveSecret: resolveSecretMock,
}));

vi.mock('@/app/backend/providers/service/endpointProfiles', () => ({
    getConnectionProfileState: getConnectionProfileStateMock,
}));

import {
    getDefaultProfileId,
    memoryEmbeddingStore,
    memoryStore,
    registerPersistenceStoreHooks,
} from '@/app/backend/persistence/__tests__/stores.shared';
import { settingsStore } from '@/app/backend/persistence/stores';
import { memorySemanticIndexService } from '@/app/backend/runtime/services/memory/memorySemanticIndexService';

registerPersistenceStoreHooks();

describe('memorySemanticIndexService', () => {
    beforeEach(() => {
        resolveSecretMock.mockReset();
        getConnectionProfileStateMock.mockReset();
        resolveSecretMock.mockResolvedValue('test-api-key');
        getConnectionProfileStateMock.mockResolvedValue(
            okOp({
                resolvedBaseUrl: 'https://api.openai.test/v1',
            })
        );
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => ({
                    data: [
                        {
                            embedding: [1, 0, 0],
                        },
                    ],
                }),
            })
        );
    });

    async function configureMemoryRetrieval(profileId: string): Promise<void> {
        await settingsStore.setString(profileId, 'memory_retrieval_provider_id', 'openai');
        await settingsStore.setString(profileId, 'memory_retrieval_model_id', 'openai/text-embedding-3-small');
    }

    it('normalizes indexed text and refreshes the stored digest when memory content changes', async () => {
        const profileId = getDefaultProfileId();
        await configureMemoryRetrieval(profileId);
        const memory = await memoryStore.create({
            profileId,
            memoryType: 'semantic',
            scopeKind: 'global',
            createdByKind: 'user',
            title: 'Project Note',
            summaryText: 'Short summary',
            bodyMarkdown: '# Heading\n\n- First bullet\n- Second bullet',
        });

        await memorySemanticIndexService.refreshMemoryIdsSafely({
            profileId,
            memoryIds: [memory.id],
            reason: 'test_initial',
        });

        const firstRecord = await memoryEmbeddingStore.getByMemoryId({
            profileId,
            memoryId: memory.id,
            providerId: 'openai',
            modelId: 'openai/text-embedding-3-small',
        });

        expect(firstRecord).not.toBeNull();
        expect(firstRecord?.indexedText).toContain('Project Note');
        expect(firstRecord?.indexedText).toContain('Short summary');
        expect(firstRecord?.indexedText).toContain('Heading');
        expect(firstRecord?.indexedText).not.toContain('#');

        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => ({
                    data: [
                        {
                            embedding: [0, 1, 0],
                        },
                    ],
                }),
            })
        );

        await memoryStore.updateEditableFields({
            profileId,
            memoryId: memory.id,
            title: 'Project Note Updated',
            bodyMarkdown: 'Fresh body text.',
            summaryText: 'Updated summary',
        });
        await memorySemanticIndexService.refreshMemoryIdsSafely({
            profileId,
            memoryIds: [memory.id],
            reason: 'test_update',
        });

        const secondRecord = await memoryEmbeddingStore.getByMemoryId({
            profileId,
            memoryId: memory.id,
            providerId: 'openai',
            modelId: 'openai/text-embedding-3-small',
        });

        expect(secondRecord).not.toBeNull();
        expect(secondRecord?.sourceDigest).not.toBe(firstRecord?.sourceDigest);
        expect(secondRecord?.embedding).toEqual([0, 1, 0]);
        expect(secondRecord?.indexedText).toContain('Project Note Updated');
    });

    it('removes the index row when a memory becomes inactive', async () => {
        const profileId = getDefaultProfileId();
        await configureMemoryRetrieval(profileId);
        const memory = await memoryStore.create({
            profileId,
            memoryType: 'semantic',
            scopeKind: 'global',
            createdByKind: 'user',
            title: 'Disposable memory',
            bodyMarkdown: 'Disposable body.',
        });

        await memorySemanticIndexService.refreshMemoryIdsSafely({
            profileId,
            memoryIds: [memory.id],
            reason: 'test_index',
        });
        await memoryStore.disable(profileId, memory.id);
        await memorySemanticIndexService.refreshMemoryIdsSafely({
            profileId,
            memoryIds: [memory.id],
            reason: 'test_disable',
        });

        expect(
            await memoryEmbeddingStore.getByMemoryId({
                profileId,
                memoryId: memory.id,
                providerId: 'openai',
                modelId: 'openai/text-embedding-3-small',
            })
        ).toBeNull();
    });

    it('rebuilds embeddings only for active memories in the configured profile/model slice', async () => {
        const profileId = getDefaultProfileId();
        await configureMemoryRetrieval(profileId);
        const activeMemory = await memoryStore.create({
            profileId,
            memoryType: 'semantic',
            scopeKind: 'global',
            createdByKind: 'user',
            title: 'Active memory',
            bodyMarkdown: 'Active body.',
        });
        const disabledMemory = await memoryStore.create({
            profileId,
            memoryType: 'semantic',
            scopeKind: 'global',
            state: 'disabled',
            createdByKind: 'user',
            title: 'Disabled memory',
            bodyMarkdown: 'Disabled body.',
        });

        await memorySemanticIndexService.rebuildProfileIndex(profileId);

        const indexedRows = await memoryEmbeddingStore.listByProviderModel({
            profileId,
            providerId: 'openai',
            modelId: 'openai/text-embedding-3-small',
        });

        expect(indexedRows.map((row) => row.memoryId)).toEqual([activeMemory.id]);
        expect(indexedRows.some((row) => row.memoryId === disabledMemory.id)).toBe(false);
    });

    it('fails soft when embedding execution fails during refresh', async () => {
        const profileId = getDefaultProfileId();
        await configureMemoryRetrieval(profileId);
        const memory = await memoryStore.create({
            profileId,
            memoryType: 'semantic',
            scopeKind: 'global',
            createdByKind: 'user',
            title: 'Fail-soft memory',
            bodyMarkdown: 'Fail-soft body.',
        });

        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

        await expect(
            memorySemanticIndexService.refreshMemoryIdsSafely({
                profileId,
                memoryIds: [memory.id],
                reason: 'test_fail_soft',
            })
        ).resolves.toBeUndefined();

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
