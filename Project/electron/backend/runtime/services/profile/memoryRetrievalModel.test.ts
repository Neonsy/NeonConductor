import { beforeEach, describe, expect, it, vi } from 'vitest';

import { errOp, okOp } from '@/app/backend/runtime/services/common/operationalError';

const {
    getStringOptionalMock,
    setStringMock,
    deleteSettingMock,
    clearProfileModelMock,
    ensureSupportedProviderMock,
    listEmbeddingModelsMock,
    rebuildProfileIndexMock,
} = vi.hoisted(() => ({
    getStringOptionalMock: vi.fn(),
    setStringMock: vi.fn(),
    deleteSettingMock: vi.fn(),
    clearProfileModelMock: vi.fn(),
    ensureSupportedProviderMock: vi.fn(),
    listEmbeddingModelsMock: vi.fn(),
    rebuildProfileIndexMock: vi.fn(),
}));

vi.mock('@/app/backend/persistence/stores', () => ({
    memoryEmbeddingStore: {
        clearProfileModel: clearProfileModelMock,
    },
    settingsStore: {
        getStringOptional: getStringOptionalMock,
        setString: setStringMock,
        delete: deleteSettingMock,
    },
}));

vi.mock('@/app/backend/providers/service/helpers', () => ({
    ensureSupportedProvider: ensureSupportedProviderMock,
}));

vi.mock('@/app/backend/providers/embeddingCatalog/service', () => ({
    providerEmbeddingCatalogService: {
        listModels: listEmbeddingModelsMock,
    },
}));

vi.mock('@/app/backend/runtime/services/memory/memorySemanticIndexService', () => ({
    memorySemanticIndexService: {
        rebuildProfileIndex: rebuildProfileIndexMock,
    },
}));

import { memoryRetrievalModelService } from '@/app/backend/runtime/services/profile/memoryRetrievalModel';

describe('memoryRetrievalModelService', () => {
    beforeEach(() => {
        getStringOptionalMock.mockReset();
        setStringMock.mockReset();
        deleteSettingMock.mockReset();
        clearProfileModelMock.mockReset();
        ensureSupportedProviderMock.mockReset();
        listEmbeddingModelsMock.mockReset();
        rebuildProfileIndexMock.mockReset();
    });

    it('rejects partial Memory Retrieval selections', async () => {
        const result = await memoryRetrievalModelService.setMemoryRetrievalModelPreference({
            profileId: 'profile_test',
            providerId: 'openai',
        });

        expect(result.isErr()).toBe(true);
        expect(setStringMock).not.toHaveBeenCalled();
    });

    it('persists a validated Memory Retrieval selection and rebuilds the semantic index', async () => {
        getStringOptionalMock.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
        ensureSupportedProviderMock.mockResolvedValue(okOp('openai'));
        listEmbeddingModelsMock.mockResolvedValue(
            okOp([
                {
                    id: 'openai/text-embedding-3-small',
                    providerId: 'openai',
                    label: 'text-embedding-3-small',
                    dimensions: 1536,
                },
            ])
        );
        setStringMock.mockResolvedValue(undefined);
        rebuildProfileIndexMock.mockResolvedValue(undefined);

        const result = await memoryRetrievalModelService.setMemoryRetrievalModelPreference({
            profileId: 'profile_test',
            providerId: 'openai',
            modelId: 'openai/text-embedding-3-small',
        });

        expect(result.isOk()).toBe(true);
        expect(setStringMock).toHaveBeenNthCalledWith(1, 'profile_test', 'memory_retrieval_provider_id', 'openai');
        expect(setStringMock).toHaveBeenNthCalledWith(
            2,
            'profile_test',
            'memory_retrieval_model_id',
            'openai/text-embedding-3-small'
        );
        expect(rebuildProfileIndexMock).toHaveBeenCalledWith('profile_test');
    });

    it('normalizes invalid persisted Memory Retrieval state to null', async () => {
        getStringOptionalMock.mockResolvedValueOnce('openai').mockResolvedValueOnce('openai/text-embedding-3-small');
        ensureSupportedProviderMock.mockResolvedValue(okOp('openai'));
        listEmbeddingModelsMock.mockResolvedValue(okOp([]));

        const preference = await memoryRetrievalModelService.getMemoryRetrievalModelPreference('profile_test');

        expect(preference).toEqual({ selection: null });
    });

    it('clears the saved Memory Retrieval selection and drops existing embeddings', async () => {
        getStringOptionalMock.mockResolvedValueOnce('openai').mockResolvedValueOnce('openai/text-embedding-3-small');
        ensureSupportedProviderMock.mockResolvedValue(okOp('openai'));
        listEmbeddingModelsMock.mockResolvedValue(
            okOp([
                {
                    id: 'openai/text-embedding-3-small',
                    providerId: 'openai',
                    label: 'text-embedding-3-small',
                    dimensions: 1536,
                },
            ])
        );
        clearProfileModelMock.mockResolvedValue(undefined);
        deleteSettingMock.mockResolvedValue(undefined);

        const result = await memoryRetrievalModelService.setMemoryRetrievalModelPreference({
            profileId: 'profile_test',
        });

        expect(result.isOk()).toBe(true);
        expect(clearProfileModelMock).toHaveBeenCalledWith({
            profileId: 'profile_test',
            providerId: 'openai',
            modelId: 'openai/text-embedding-3-small',
        });
        expect(deleteSettingMock).toHaveBeenNthCalledWith(1, 'profile_test', 'memory_retrieval_provider_id');
        expect(deleteSettingMock).toHaveBeenNthCalledWith(2, 'profile_test', 'memory_retrieval_model_id');
    });

    it('rejects unsupported Memory Retrieval providers', async () => {
        ensureSupportedProviderMock.mockResolvedValue(errOp('provider_not_supported', 'Unsupported provider.'));

        const result = await memoryRetrievalModelService.setMemoryRetrievalModelPreference({
            profileId: 'profile_test',
            providerId: 'unknown' as never,
            modelId: 'unknown/model',
        });

        expect(result.isErr()).toBe(true);
        expect(setStringMock).not.toHaveBeenCalled();
    });
});
