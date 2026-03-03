import { providerStore } from '@/app/backend/persistence/stores';
import { assertSupportedProviderId } from '@/app/backend/providers/registry';
import type { ResolvedRunTarget } from '@/app/backend/runtime/services/runExecution/types';

export async function resolveRunTarget(input: {
    profileId: string;
    providerId?: string;
    modelId?: string;
}): Promise<ResolvedRunTarget> {
    const defaults = await providerStore.getDefaults(input.profileId);

    let providerId = input.providerId ? assertSupportedProviderId(input.providerId) : undefined;
    let modelId = input.modelId;

    if (!providerId && modelId) {
        const inferred = modelId.split('/')[0] ?? '';
        providerId = assertSupportedProviderId(inferred);
    }

    if (!providerId) {
        providerId = assertSupportedProviderId(defaults.providerId);
    }

    if (!modelId) {
        if (defaults.providerId === providerId) {
            modelId = defaults.modelId;
        } else {
            const models = await providerStore.listModels(input.profileId, providerId);
            modelId = models.at(0)?.id;
        }
    }

    if (!modelId) {
        throw new Error(`No model available for provider "${providerId}".`);
    }

    const modelExists = await providerStore.modelExists(input.profileId, providerId, modelId);
    if (!modelExists) {
        throw new Error(`Model "${modelId}" is not available for provider "${providerId}".`);
    }

    return {
        providerId,
        modelId,
    };
}
