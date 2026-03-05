import { useMemo } from 'react';

import {
    isProviderId,
    isProviderRunnable,
    modelExists,
    resolveLatestRunTarget,
    type RunTargetSelection,
} from '@/web/components/conversation/shellHelpers';

import type { RunRecord, RuntimeSnapshotV1 } from '@/app/backend/persistence/types';
import type { RuntimeProviderId } from '@/app/backend/runtime/contracts';

interface UseConversationShellRunTargetInput {
    providers: RuntimeSnapshotV1['providers'];
    providerModels: RuntimeSnapshotV1['providerModels'];
    defaults: RuntimeSnapshotV1['defaults'] | undefined;
    sessionOverride?: { providerId?: RuntimeProviderId; modelId?: string };
    runs: RunRecord[];
}

export function useConversationShellRunTarget(input: UseConversationShellRunTargetInput) {
    const providerById = useMemo(() => {
        return new Map(input.providers.map((provider) => [provider.id, provider]));
    }, [input.providers]);

    const modelsByProvider = useMemo(() => {
        const map = new Map<RuntimeProviderId, RuntimeSnapshotV1['providerModels']>();
        for (const model of input.providerModels) {
            const existing = map.get(model.providerId) ?? [];
            existing.push(model);
            map.set(model.providerId, existing);
        }
        return map;
    }, [input.providerModels]);

    const resolvedRunTarget = useMemo<RunTargetSelection | undefined>(() => {
        if (input.sessionOverride?.providerId && input.sessionOverride.modelId) {
            if (modelExists(modelsByProvider, input.sessionOverride.providerId, input.sessionOverride.modelId)) {
                return {
                    providerId: input.sessionOverride.providerId,
                    modelId: input.sessionOverride.modelId,
                };
            }
        }

        const fromLatestRun = resolveLatestRunTarget(input.runs, modelsByProvider);
        if (fromLatestRun) {
            return fromLatestRun;
        }

        if (
            input.defaults &&
            isProviderId(input.defaults.providerId) &&
            modelExists(modelsByProvider, input.defaults.providerId, input.defaults.modelId)
        ) {
            return {
                providerId: input.defaults.providerId,
                modelId: input.defaults.modelId,
            };
        }

        for (const provider of input.providers) {
            const models = modelsByProvider.get(provider.id) ?? [];
            if (models.length === 0) {
                continue;
            }

            if (isProviderRunnable(provider.authState, provider.authMethod)) {
                const firstModel = models[0];
                if (!firstModel) {
                    continue;
                }
                return {
                    providerId: provider.id,
                    modelId: firstModel.id,
                };
            }
        }

        for (const provider of input.providers) {
            const models = modelsByProvider.get(provider.id) ?? [];
            if (models.length === 0) {
                continue;
            }

            const firstModel = models[0];
            if (!firstModel) {
                continue;
            }
            return {
                providerId: provider.id,
                modelId: firstModel.id,
            };
        }

        return undefined;
    }, [input.defaults, input.providers, input.runs, input.sessionOverride, modelsByProvider]);

    const selectedProviderIdForComposer = input.sessionOverride?.providerId ?? resolvedRunTarget?.providerId;
    const selectedModelIdForComposer = input.sessionOverride?.modelId ?? resolvedRunTarget?.modelId;

    const providerOptions = useMemo(() => {
        return input.providers
            .filter((provider) => (modelsByProvider.get(provider.id) ?? []).length > 0)
            .map((provider) => ({
                id: provider.id,
                label: provider.label,
                authState: provider.authState,
            }));
    }, [input.providers, modelsByProvider]);

    const modelOptions = useMemo(() => {
        if (!selectedProviderIdForComposer) {
            return [];
        }

        return (modelsByProvider.get(selectedProviderIdForComposer) ?? []).map((model) => ({
            id: model.id,
            label: model.label,
            ...(model.price !== undefined ? { price: model.price } : {}),
            ...(model.latency !== undefined ? { latency: model.latency } : {}),
            ...(model.tps !== undefined ? { tps: model.tps } : {}),
        }));
    }, [modelsByProvider, selectedProviderIdForComposer]);

    return {
        providerById,
        modelsByProvider,
        resolvedRunTarget,
        selectedProviderIdForComposer,
        selectedModelIdForComposer,
        providerOptions,
        modelOptions,
    };
}
