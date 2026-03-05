import { providerStore } from '@/app/backend/persistence/stores';
import type { RuntimeProviderId } from '@/app/backend/runtime/contracts';
import { resolveRunAuth } from '@/app/backend/runtime/services/runExecution/resolveRunAuth';
import type { ResolvedRunAuth, ResolvedRunTarget } from '@/app/backend/runtime/services/runExecution/types';

export interface RunnableRunTarget {
    target: ResolvedRunTarget;
    auth: ResolvedRunAuth;
}

export async function resolveFirstRunnableRunTarget(
    profileId: string,
    excluded?: { providerId: RuntimeProviderId; modelId: string }
): Promise<RunnableRunTarget | null> {
    const providers = await providerStore.listProviders();

    for (const provider of providers) {
        const models = await providerStore.listModels(profileId, provider.id);
        if (models.length === 0) {
            continue;
        }

        const authResult = await resolveRunAuth({
            profileId,
            providerId: provider.id,
        });
        if (authResult.isErr()) {
            continue;
        }
        const auth: ResolvedRunAuth = authResult.value;

        for (const model of models) {
            if (excluded && excluded.providerId === provider.id && excluded.modelId === model.id) {
                continue;
            }

            return {
                target: {
                    providerId: provider.id,
                    modelId: model.id,
                },
                auth,
            };
        }
    }

    return null;
}
