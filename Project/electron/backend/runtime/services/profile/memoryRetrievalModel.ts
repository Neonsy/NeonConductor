import { memoryEmbeddingStore, settingsStore } from '@/app/backend/persistence/stores';
import { providerEmbeddingCatalogService } from '@/app/backend/providers/embeddingCatalog/service';
import { ensureSupportedProvider } from '@/app/backend/providers/service/helpers';
import type {
    MemoryRetrievalModelPreference,
    MemoryRetrievalModelSelection,
    ProfileSetMemoryRetrievalModelInput,
    RuntimeProviderId,
} from '@/app/backend/runtime/contracts';
import { errOp, okOp, type OperationalResult } from '@/app/backend/runtime/services/common/operationalError';
import { memorySemanticIndexService } from '@/app/backend/runtime/services/memory/memorySemanticIndexService';
import { canonicalizeProviderModelId } from '@/shared/kiloModels';

const MEMORY_RETRIEVAL_PROVIDER_ID_SETTING_KEY = 'memory_retrieval_provider_id';
const MEMORY_RETRIEVAL_MODEL_ID_SETTING_KEY = 'memory_retrieval_model_id';

async function readPersistedMemoryRetrievalSelection(profileId: string): Promise<MemoryRetrievalModelSelection | null> {
    const [providerIdRaw, modelIdRaw] = await Promise.all([
        settingsStore.getStringOptional(profileId, MEMORY_RETRIEVAL_PROVIDER_ID_SETTING_KEY),
        settingsStore.getStringOptional(profileId, MEMORY_RETRIEVAL_MODEL_ID_SETTING_KEY),
    ]);

    if (!providerIdRaw || !modelIdRaw) {
        return null;
    }

    const ensuredProviderResult = await ensureSupportedProvider(providerIdRaw as RuntimeProviderId);
    if (ensuredProviderResult.isErr()) {
        return null;
    }

    const providerId = ensuredProviderResult.value;
    const modelId = canonicalizeProviderModelId(providerId, modelIdRaw);
    const catalogResult = await providerEmbeddingCatalogService.listModels(profileId, providerId);
    if (catalogResult.isErr()) {
        return null;
    }

    if (!catalogResult.value.some((candidate) => candidate.id === modelId)) {
        return null;
    }

    return {
        providerId,
        modelId,
    };
}

class MemoryRetrievalModelService {
    async getMemoryRetrievalModelPreference(profileId: string): Promise<MemoryRetrievalModelPreference> {
        return {
            selection: await readPersistedMemoryRetrievalSelection(profileId),
        };
    }

    async setMemoryRetrievalModelPreference(
        input: ProfileSetMemoryRetrievalModelInput
    ): Promise<OperationalResult<MemoryRetrievalModelPreference>> {
        const previousSelection = await readPersistedMemoryRetrievalSelection(input.profileId);
        const providerId = input.providerId;
        const modelId = input.modelId?.trim();

        if ((providerId && !modelId) || (!providerId && modelId)) {
            return errOp(
                'invalid_input',
                'Memory Retrieval selection requires both providerId and modelId, or neither to clear the selection.'
            );
        }

        if (!providerId && !modelId) {
            if (previousSelection) {
                await memoryEmbeddingStore.clearProfileModel({
                    profileId: input.profileId,
                    providerId: previousSelection.providerId,
                    modelId: previousSelection.modelId,
                });
            }
            await Promise.all([
                settingsStore.delete(input.profileId, MEMORY_RETRIEVAL_PROVIDER_ID_SETTING_KEY),
                settingsStore.delete(input.profileId, MEMORY_RETRIEVAL_MODEL_ID_SETTING_KEY),
            ]);

            return okOp({ selection: null });
        }

        const requiredProviderId = providerId;
        const requiredModelId = modelId;
        if (!requiredProviderId || !requiredModelId) {
            return errOp(
                'invalid_input',
                'Memory Retrieval selection requires both providerId and modelId, or neither to clear the selection.'
            );
        }

        const ensuredProviderResult = await ensureSupportedProvider(requiredProviderId);
        if (ensuredProviderResult.isErr()) {
            return errOp(ensuredProviderResult.error.code, ensuredProviderResult.error.message);
        }

        const resolvedProviderId = ensuredProviderResult.value;
        const canonicalModelId = canonicalizeProviderModelId(resolvedProviderId, requiredModelId);
        const catalogResult = await providerEmbeddingCatalogService.listModels(input.profileId, resolvedProviderId);
        if (catalogResult.isErr()) {
            return errOp(catalogResult.error.code, catalogResult.error.message);
        }

        if (!catalogResult.value.some((candidate) => candidate.id === canonicalModelId)) {
            return errOp(
                'provider_model_missing',
                `Model "${canonicalModelId}" is not available for provider "${resolvedProviderId}".`
            );
        }

        await Promise.all([
            settingsStore.setString(input.profileId, MEMORY_RETRIEVAL_PROVIDER_ID_SETTING_KEY, resolvedProviderId),
            settingsStore.setString(input.profileId, MEMORY_RETRIEVAL_MODEL_ID_SETTING_KEY, canonicalModelId),
        ]);

        if (
            previousSelection &&
            (previousSelection.providerId !== resolvedProviderId || previousSelection.modelId !== canonicalModelId)
        ) {
            await memoryEmbeddingStore.clearProfileModel({
                profileId: input.profileId,
                providerId: previousSelection.providerId,
                modelId: previousSelection.modelId,
            });
        }
        await memorySemanticIndexService.rebuildProfileIndex(input.profileId);

        return okOp({
            selection: {
                providerId: resolvedProviderId,
                modelId: canonicalModelId,
            },
        });
    }
}

export const memoryRetrievalModelService = new MemoryRetrievalModelService();
