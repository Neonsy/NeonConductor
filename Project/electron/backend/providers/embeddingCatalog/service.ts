import { providerStore } from '@/app/backend/persistence/stores';
import { providerEmbeddingCatalogStore } from '@/app/backend/persistence/stores/provider/providerEmbeddingCatalogStore';
import { getEmbeddingCatalogAdapter } from '@/app/backend/providers/embeddingCatalog/adapters';
import { okProviderService, errProviderService, type ProviderServiceResult } from '@/app/backend/providers/service/errors';
import type {
    ProviderEmbeddingControlEntry,
    ProviderEmbeddingControlSnapshot,
} from '@/app/backend/providers/service/types';
import type { ProviderEmbeddingModelRecord } from '@/app/backend/persistence/types';
import type { RuntimeProviderId } from '@/app/backend/runtime/contracts';

function isEmbeddingProvider(providerId: RuntimeProviderId): providerId is 'openai' {
    return providerId === 'openai';
}

export class ProviderEmbeddingCatalogService {
    private async syncIfNeeded(
        profileId: string,
        providerId: RuntimeProviderId
    ): Promise<ProviderServiceResult<ProviderEmbeddingModelRecord[]>> {
        const existing = await providerEmbeddingCatalogStore.listModels(profileId, providerId);
        if (existing.length > 0) {
            return okProviderService(existing);
        }

        const adapter = getEmbeddingCatalogAdapter(providerId);
        if (!adapter) {
            return okProviderService(existing);
        }

        const result = await adapter.syncCatalog({ profileId });
        if (result.isErr()) {
            return errProviderService('request_unavailable', result.error.message);
        }

        await providerEmbeddingCatalogStore.replaceModels(profileId, providerId, result.value.models);
        return okProviderService(await providerEmbeddingCatalogStore.listModels(profileId, providerId));
    }

    async listModels(profileId: string, providerId: RuntimeProviderId): Promise<ProviderServiceResult<ProviderEmbeddingModelRecord[]>> {
        if (!isEmbeddingProvider(providerId)) {
            return errProviderService(
                'provider_not_supported',
                `Provider "${providerId}" does not expose embedding models.`
            );
        }

        return this.syncIfNeeded(profileId, providerId);
    }

    async listModelsByProfile(profileId: string): Promise<ProviderEmbeddingModelRecord[]> {
        const modelsResult = await this.syncIfNeeded(profileId, 'openai');
        return modelsResult.isOk() ? modelsResult.value : [];
    }

    async getControlPlane(profileId: string): Promise<ProviderServiceResult<ProviderEmbeddingControlSnapshot>> {
        const providers = await providerStore.listProviders();
        const openAIProvider = providers.find((provider) => provider.id === 'openai');
        if (!openAIProvider) {
            return errProviderService('provider_not_registered', 'OpenAI provider is not registered.');
        }

        const modelsResult = await this.listModels(profileId, 'openai');
        if (modelsResult.isErr()) {
            return errProviderService(modelsResult.error.code, modelsResult.error.message);
        }

        const entry: ProviderEmbeddingControlEntry = {
            provider: openAIProvider,
            models: modelsResult.value,
        };

        return okProviderService({
            entries: [entry],
        });
    }
}

export const providerEmbeddingCatalogService = new ProviderEmbeddingCatalogService();
