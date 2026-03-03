import { getProviderCatalogBehavior } from '@/app/backend/providers/behaviors';
import type { KiloGatewayModel } from '@/app/backend/providers/kiloGatewayClient/types';
import type { ProviderCatalogModel } from '@/app/backend/providers/types';

export function buildModelsByProviderIndex(
    payload: Array<{ providerId: string; modelIds: string[] }>
): Map<string, Set<string>> {
    const index = new Map<string, Set<string>>();
    for (const entry of payload) {
        index.set(entry.providerId, new Set(entry.modelIds));
    }

    return index;
}

export function normalizeKiloModel(model: KiloGatewayModel): ProviderCatalogModel {
    const behavior = getProviderCatalogBehavior('kilo');
    const capabilities = behavior.createCapabilities({
        modelId: model.id,
        supportedParameters: model.supportedParameters,
        inputModalities: model.inputModalities,
        outputModalities: model.outputModalities,
        ...(model.promptFamily !== undefined ? { promptFamily: model.promptFamily } : {}),
    });

    return {
        modelId: model.id,
        label: model.name,
        ...(model.upstreamProvider ? { upstreamProvider: model.upstreamProvider } : {}),
        isFree: model.id.endsWith(':free'),
        capabilities,
        ...(model.contextLength !== undefined ? { contextLength: model.contextLength } : {}),
        pricing: model.pricing,
        raw: model.raw,
    };
}
