import {
    buildModelsByProviderIndex,
    classifyKiloModel,
    type KiloRejectedModelDiagnostic,
} from '@/app/backend/providers/adapters/kilo/modelNormalization';
import { kiloGatewayClient } from '@/app/backend/providers/kiloGatewayClient';
import type { ProviderCatalogModel, ProviderCatalogSyncResult } from '@/app/backend/providers/types';
import { appLog } from '@/app/main/logging';

interface SyncKiloCatalogInput {
    profileId: string;
    authMethod: 'none' | 'api_key' | 'device_code' | 'oauth_pkce' | 'oauth_device';
    apiKey?: string;
    accessToken?: string;
    organizationId?: string;
    force?: boolean;
}

export async function syncKiloCatalog(input: SyncKiloCatalogInput): Promise<ProviderCatalogSyncResult> {
    const accessToken = input.apiKey ?? input.accessToken;
    if (!accessToken) {
        return {
            ok: false,
            status: 'error',
            providerId: 'kilo',
            reason: 'auth_required',
            detail: 'Kilo sync requires an access token.',
        };
    }

    try {
        const requestHeaders = {
            accessToken,
            ...(input.organizationId ? { organizationId: input.organizationId } : {}),
        };

        const [modelsResult, providersResult, modelsByProviderResult] = await Promise.all([
            kiloGatewayClient.getModels(requestHeaders),
            kiloGatewayClient.getProviders(requestHeaders),
            kiloGatewayClient.getModelsByProvider(requestHeaders),
        ]);
        if (modelsResult.isErr()) {
            return {
                ok: false,
                status: 'error',
                providerId: 'kilo',
                reason: 'sync_failed',
                detail: modelsResult.error.message,
            };
        }
        if (providersResult.isErr()) {
            return {
                ok: false,
                status: 'error',
                providerId: 'kilo',
                reason: 'sync_failed',
                detail: providersResult.error.message,
            };
        }
        const models = modelsResult.value;
        const providers = providersResult.value;
        const modelsByProvider = modelsByProviderResult.isOk() ? modelsByProviderResult.value : [];
        const modelsByProviderIndex = buildModelsByProviderIndex(modelsByProvider);
        const normalizedModels: ProviderCatalogModel[] = [];
        const rejectedModels: KiloRejectedModelDiagnostic[] = [];

        for (const model of models) {
            const classification = classifyKiloModel(model, {
                modelsByProviderIndex,
            });
            if (classification.status === 'rejected') {
                rejectedModels.push(classification.diagnostic);
                appLog.warn({
                    tag: 'provider.kilo',
                    message: 'Rejected Kilo catalog model during runtime classification.',
                    modelId: classification.diagnostic.modelId,
                    reason: classification.diagnostic.reason,
                    detail: classification.diagnostic.detail,
                    upstreamProvider: classification.diagnostic.upstreamProvider ?? null,
                    promptFamily: classification.diagnostic.promptFamily ?? null,
                });
                continue;
            }

            const entry = classification.model;
            if (entry.upstreamProvider && modelsByProviderIndex.has(entry.upstreamProvider)) {
                const hasMembership = modelsByProviderIndex.get(entry.upstreamProvider)?.has(entry.modelId) ?? false;
                normalizedModels.push({
                    ...entry,
                    raw: {
                        ...entry.raw,
                        modelsByProviderMembership: hasMembership,
                    },
                });
                continue;
            }

            normalizedModels.push(entry);
        }

        if (models.length > 0 && normalizedModels.length === 0) {
            return {
                ok: false,
                status: 'error',
                providerId: 'kilo',
                reason: 'sync_failed',
                detail: 'Kilo catalog sync rejected every discovered model during runtime classification.',
            };
        }

        return {
            ok: true,
            status: 'synced',
            providerId: 'kilo',
            models: normalizedModels,
            providerPayload: {
                providers,
                modelsByProvider,
                rejectedModels,
            },
            modelPayload: {
                models,
                rejectedModels,
            },
        };
    } catch (error) {
        return {
            ok: false,
            status: 'error',
            providerId: 'kilo',
            reason: 'sync_failed',
            detail: error instanceof Error ? error.message : String(error),
        };
    }
}
