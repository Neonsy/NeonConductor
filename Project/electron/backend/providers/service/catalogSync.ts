import { providerCatalogStore } from '@/app/backend/persistence/stores';
import { getProviderAdapter } from '@/app/backend/providers/adapters';
import { providerAuthExecutionService } from '@/app/backend/providers/providerAuthExecutionService';
import { toProviderServiceException } from '@/app/backend/providers/service/errors';
import { ensureSupportedProvider, resolveSecret } from '@/app/backend/providers/service/helpers';
import type { ProviderSyncResult } from '@/app/backend/providers/service/types';
import type { RuntimeProviderId } from '@/app/backend/runtime/contracts';
import { appLog } from '@/app/main/logging';

export async function syncCatalog(
    profileId: string,
    providerId: RuntimeProviderId,
    force = false
): Promise<ProviderSyncResult> {
    appLog.info({
        tag: 'provider.catalog-sync',
        message: 'Starting provider catalog sync.',
        profileId,
        providerId,
        force,
    });

    const ensuredProviderResult = await ensureSupportedProvider(providerId);
    if (ensuredProviderResult.isErr()) {
        appLog.warn({
            tag: 'provider.catalog-sync',
            message: 'Catalog sync rejected for unsupported or unregistered provider.',
            profileId,
            providerId,
            reason: ensuredProviderResult.error.code,
            error: ensuredProviderResult.error.message,
        });
        throw toProviderServiceException(ensuredProviderResult.error);
    }

    const supportedProviderId = ensuredProviderResult.value;
    const adapter = getProviderAdapter(supportedProviderId);
    const authState = await providerAuthExecutionService.getAuthState(profileId, supportedProviderId);
    const [apiKey, accessToken] = await Promise.all([
        resolveSecret(profileId, supportedProviderId, 'api_key'),
        resolveSecret(profileId, supportedProviderId, 'access_token'),
    ]);

    appLog.info({
        tag: 'provider.catalog-sync',
        message: 'Resolved catalog sync auth context.',
        profileId,
        providerId: supportedProviderId,
        authMethod: authState.authMethod,
        authState: authState.authState,
        hasApiKey: Boolean(apiKey),
        hasAccessToken: Boolean(accessToken),
        hasOrganizationId: Boolean(authState.organizationId),
    });

    const syncResult = await adapter.syncCatalog({
        profileId,
        authMethod: authState.authMethod,
        ...(apiKey ? { apiKey } : {}),
        ...(accessToken ? { accessToken } : {}),
        ...(authState.organizationId ? { organizationId: authState.organizationId } : {}),
        ...(force ? { force } : {}),
    });

    if (!syncResult.ok) {
        try {
            await providerCatalogStore.upsertDiscoverySnapshot({
                profileId,
                providerId: supportedProviderId,
                kind: 'models',
                payload: { reason: syncResult.reason, detail: syncResult.detail ?? null },
                status: 'error',
            });
            appLog.info({
                tag: 'provider.catalog-sync',
                message: 'Persisted error discovery snapshot for failed sync.',
                profileId,
                providerId: supportedProviderId,
                reason: syncResult.reason,
            });
        } catch (snapshotError) {
            appLog.warn({
                tag: 'provider.catalog-sync',
                message: 'Failed to persist error discovery snapshot for catalog sync.',
                profileId,
                providerId: supportedProviderId,
                reason: syncResult.reason,
                error: snapshotError instanceof Error ? snapshotError.message : String(snapshotError),
            });
        }

        appLog.warn({
            tag: 'provider.catalog-sync',
            message: 'Provider catalog sync failed.',
            profileId,
            providerId: supportedProviderId,
            reason: syncResult.reason,
            detail: syncResult.detail ?? null,
        });

        return {
            ok: false,
            status: 'error',
            providerId: supportedProviderId,
            reason: syncResult.reason,
            ...(syncResult.detail ? { detail: syncResult.detail } : {}),
            modelCount: 0,
        };
    }

    const replaceResult = await providerCatalogStore.replaceModels(
        profileId,
        supportedProviderId,
        syncResult.models.map((model) => ({
            modelId: model.modelId,
            label: model.label,
            ...(model.upstreamProvider ? { upstreamProvider: model.upstreamProvider } : {}),
            isFree: model.isFree,
            supportsTools: model.capabilities.supportsTools,
            supportsReasoning: model.capabilities.supportsReasoning,
            supportsVision: model.capabilities.supportsVision,
            supportsAudioInput: model.capabilities.supportsAudioInput,
            supportsAudioOutput: model.capabilities.supportsAudioOutput,
            inputModalities: model.capabilities.inputModalities,
            outputModalities: model.capabilities.outputModalities,
            ...(model.capabilities.promptFamily ? { promptFamily: model.capabilities.promptFamily } : {}),
            ...(model.contextLength !== undefined ? { contextLength: model.contextLength } : {}),
            pricing: model.pricing,
            raw: model.raw,
            source: 'discovery',
        }))
    );

    await Promise.all([
        providerCatalogStore.upsertDiscoverySnapshot({
            profileId,
            providerId: supportedProviderId,
            kind: 'models',
            payload: syncResult.modelPayload,
            status: 'ok',
        }),
        providerCatalogStore.upsertDiscoverySnapshot({
            profileId,
            providerId: supportedProviderId,
            kind: 'providers',
            payload: syncResult.providerPayload,
            status: 'ok',
        }),
    ]);

    appLog.info({
        tag: 'provider.catalog-sync',
        message: 'Provider catalog sync completed.',
        profileId,
        providerId: supportedProviderId,
        status: replaceResult.changed ? 'synced' : 'unchanged',
        changed: replaceResult.changed,
        modelCount: replaceResult.modelCount,
    });

    return {
        ok: true,
        status: replaceResult.changed ? 'synced' : 'unchanged',
        providerId: supportedProviderId,
        modelCount: replaceResult.modelCount,
    };
}
