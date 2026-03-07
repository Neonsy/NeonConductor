import { methodLabel } from '@/web/components/settings/providerSettings/helpers';
import type { ActiveAuthFlow } from '@/web/components/settings/providerSettings/types';
import { trpc } from '@/web/trpc/client';

import type { RuntimeProviderId } from '@/app/backend/runtime/contracts';

interface UseProviderSettingsMutationsInput {
    profileId: string;
    selectedProviderId: RuntimeProviderId | undefined;
    setStatusMessage: (value: string | undefined) => void;
    setApiKeyInput: (value: string) => void;
    setActiveAuthFlow: (value: ActiveAuthFlow | undefined) => void;
    refetchProviders: () => void;
    refetchDefaults: () => void;
    refetchAuthState: () => void;
    refetchListModels: () => void;
    refetchKiloRoutingPreference: () => void;
    refetchKiloModelProviders: () => void;
    refetchAccountContext: () => void;
    refetchOpenAIRateLimits: () => void;
}

export function useProviderSettingsMutations(input: UseProviderSettingsMutationsInput) {
    const setDefaultMutation = trpc.provider.setDefault.useMutation({
        onSuccess: (result) => {
            if (!result.success) {
                input.setStatusMessage(
                    result.reason === 'model_not_found' ? 'Selected model is not available.' : 'Default update failed.'
                );
                return;
            }

            input.setStatusMessage('Default provider/model updated.');
            input.refetchProviders();
            input.refetchDefaults();
        },
    });

    const setApiKeyMutation = trpc.provider.setApiKey.useMutation({
        onSuccess: (result) => {
            if (!result.success) {
                input.setStatusMessage('Provider not found.');
                return;
            }

            input.setApiKeyInput('');
            input.setStatusMessage('API key saved. Provider is ready.');
            input.refetchProviders();
            input.refetchAuthState();
            if (input.selectedProviderId === 'openai') {
                input.refetchOpenAIRateLimits();
            }
        },
    });

    const setEndpointProfileMutation = trpc.provider.setEndpointProfile.useMutation({
        onSuccess: () => {
            input.setStatusMessage('Endpoint profile updated.');
            input.refetchProviders();
            input.refetchListModels();
            input.refetchDefaults();
        },
    });

    const syncCatalogMutation = trpc.provider.syncCatalog.useMutation({
        onSuccess: (result) => {
            if (!result.ok) {
                input.setStatusMessage(
                    result.reason ? `Catalog sync failed: ${result.reason}` : 'Catalog sync failed.'
                );
                return;
            }

            input.setStatusMessage(`Catalog synced (${String(result.modelCount)} models).`);
            input.refetchListModels();
            input.refetchDefaults();
        },
    });

    const setModelRoutingPreferenceMutation = trpc.provider.setModelRoutingPreference.useMutation({
        onSuccess: () => {
            input.refetchKiloRoutingPreference();
            input.refetchKiloModelProviders();
        },
    });

    const setOrganizationMutation = trpc.provider.setOrganization.useMutation({
        onSuccess: () => {
            input.setStatusMessage('Kilo organization updated.');
            input.refetchAccountContext();
            input.refetchAuthState();
            input.refetchProviders();
            input.refetchDefaults();
            input.refetchListModels();
        },
    });

    const startAuthMutation = trpc.provider.startAuth.useMutation({
        onSuccess: (result, variables) => {
            input.setStatusMessage(`${methodLabel(variables.method)} flow started.`);
            input.setActiveAuthFlow({
                providerId: variables.providerId,
                flowId: result.flow.id,
                ...(result.userCode ? { userCode: result.userCode } : {}),
                ...(result.verificationUri ? { verificationUri: result.verificationUri } : {}),
                pollAfterSeconds: result.pollAfterSeconds ?? 5,
            });
            input.refetchAuthState();
            input.refetchProviders();
            if (variables.providerId === 'openai') {
                input.refetchOpenAIRateLimits();
            }
        },
    });

    const pollAuthMutation = trpc.provider.pollAuth.useMutation({
        onSuccess: (result) => {
            if (result.flow.status === 'pending') {
                input.setStatusMessage('Waiting for authorization confirmation...');
                return;
            }

            input.setStatusMessage(`Auth flow ${result.flow.status}. State: ${result.state.authState}.`);
            input.setActiveAuthFlow(undefined);
            input.refetchAuthState();
            input.refetchProviders();
            if (input.selectedProviderId === 'kilo') {
                input.refetchAccountContext();
            }
            if (input.selectedProviderId === 'openai') {
                input.refetchOpenAIRateLimits();
            }
        },
    });

    const cancelAuthMutation = trpc.provider.cancelAuth.useMutation({
        onSuccess: () => {
            input.setStatusMessage('Auth flow cancelled.');
            input.setActiveAuthFlow(undefined);
            input.refetchAuthState();
            input.refetchProviders();
            if (input.selectedProviderId === 'openai') {
                input.refetchOpenAIRateLimits();
            }
        },
    });

    return {
        setDefaultMutation,
        setApiKeyMutation,
        setEndpointProfileMutation,
        syncCatalogMutation,
        setModelRoutingPreferenceMutation,
        setOrganizationMutation,
        startAuthMutation,
        pollAuthMutation,
        cancelAuthMutation,
    };
}
