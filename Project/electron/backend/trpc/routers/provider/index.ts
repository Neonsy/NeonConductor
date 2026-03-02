import {
    providerListModelsInputSchema,
    providerSetDefaultInputSchema,
} from '@/app/backend/runtime/contracts';
import { getRuntimeState } from '@/app/backend/runtime/state';
import { publicProcedure, router } from '@/app/backend/trpc/init';

export const providerRouter = router({
    listProviders: publicProcedure.query(() => {
        const state = getRuntimeState();

        return {
            providers: state.providers.map((provider) => ({
                ...provider,
                isDefault: provider.id === state.defaultProviderId,
            })),
        };
    }),
    listModels: publicProcedure.input(providerListModelsInputSchema).query(({ input }) => {
        const state = getRuntimeState();
        const { providerId } = input;

        if (!providerId) {
            const models = [...state.modelsByProvider.values()].flat();
            return { models };
        }

        return { models: state.modelsByProvider.get(providerId) ?? [] };
    }),
    setDefault: publicProcedure.input(providerSetDefaultInputSchema).mutation(({ input }) => {
        const state = getRuntimeState();
        const provider = state.providers.find((item) => item.id === input.providerId);
        if (!provider) {
            return {
                success: false as const,
                reason: 'provider_not_found' as const,
                defaultProviderId: state.defaultProviderId,
                defaultModelId: state.defaultModelId,
            };
        }

        const providerModels = state.modelsByProvider.get(provider.id) ?? [];
        const hasModel = providerModels.some((model) => model.id === input.modelId);
        if (!hasModel) {
            return {
                success: false as const,
                reason: 'model_not_found' as const,
                defaultProviderId: state.defaultProviderId,
                defaultModelId: state.defaultModelId,
            };
        }

        state.defaultProviderId = provider.id;
        state.defaultModelId = input.modelId;

        return {
            success: true as const,
            reason: null,
            defaultProviderId: state.defaultProviderId,
            defaultModelId: state.defaultModelId,
        };
    }),
});
