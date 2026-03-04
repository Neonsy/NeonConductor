import { providerStore } from '@/app/backend/persistence/stores';
import { assertSupportedProviderId } from '@/app/backend/providers/registry';
import type { RuntimeProviderId } from '@/app/backend/runtime/contracts';
import type { ResolvedRunTarget } from '@/app/backend/runtime/services/runExecution/types';

function tryAssertProviderId(value: string): RuntimeProviderId | undefined {
    try {
        return assertSupportedProviderId(value);
    } catch {
        return undefined;
    }
}

async function resolveFirstModelForProvider(profileId: string, providerId: RuntimeProviderId): Promise<string | undefined> {
    const models = await providerStore.listModels(profileId, providerId);
    return models.at(0)?.id;
}

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
        providerId = tryAssertProviderId(defaults.providerId);
    }

    if (providerId && !modelId) {
        if (defaults.providerId === providerId && defaults.modelId.trim().length > 0) {
            modelId = defaults.modelId;
        } else {
            modelId = await resolveFirstModelForProvider(input.profileId, providerId);
        }
    }

    if (!providerId || !modelId) {
        const providers = await providerStore.listProviders();
        for (const provider of providers) {
            const firstModel = await resolveFirstModelForProvider(input.profileId, provider.id);
            if (!firstModel) {
                continue;
            }

            providerId = provider.id;
            modelId = firstModel;
            break;
        }
    }

    if (!providerId || !modelId) {
        throw new Error('No model available for any configured provider.');
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
