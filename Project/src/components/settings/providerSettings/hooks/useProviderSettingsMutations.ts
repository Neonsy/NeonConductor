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
}

export function useProviderSettingsMutations(input: UseProviderSettingsMutationsInput) {
    const utils = trpc.useUtils();

    const setDefaultMutation = trpc.provider.setDefault.useMutation({
        onSuccess: (result) => {
            if (!result.success) {
                input.setStatusMessage(
                    result.reason === 'model_not_found' ? 'Selected model is not available.' : 'Default update failed.'
                );
                return;
            }

            input.setStatusMessage('Default provider/model updated.');
            void utils.provider.getDefaults.setData(
                { profileId: input.profileId },
                {
                    defaults: {
                        providerId: result.defaultProviderId,
                        modelId: result.defaultModelId,
                    },
                }
            );
            void utils.provider.listProviders.invalidate({ profileId: input.profileId });
        },
    });

    const setApiKeyMutation = trpc.provider.setApiKey.useMutation({
        onSuccess: (result, variables) => {
            if (!result.success) {
                input.setStatusMessage('Provider not found.');
                return;
            }

            input.setApiKeyInput('');
            input.setStatusMessage('API key saved. Provider is ready.');
            void utils.provider.listProviders.invalidate({ profileId: input.profileId });
            void utils.provider.getAuthState.setData(
                {
                    profileId: input.profileId,
                    providerId: variables.providerId,
                },
                {
                    found: true,
                    state: result.state,
                }
            );
            if (variables.providerId === 'openai') {
                void utils.provider.getOpenAISubscriptionRateLimits.invalidate({ profileId: input.profileId });
            }
        },
    });

    const setEndpointProfileMutation = trpc.provider.setEndpointProfile.useMutation({
        onSuccess: ({ endpointProfile }) => {
            input.setStatusMessage('Endpoint profile updated.');
            void utils.provider.getEndpointProfile.setData(
                {
                    profileId: input.profileId,
                    providerId: input.selectedProviderId ?? 'openai',
                },
                {
                    endpointProfile,
                }
            );
            void Promise.all([
                utils.provider.listProviders.invalidate({ profileId: input.profileId }),
                utils.provider.listModels.invalidate({
                    profileId: input.profileId,
                    providerId: input.selectedProviderId ?? 'openai',
                }),
                utils.provider.getDefaults.invalidate({ profileId: input.profileId }),
            ]);
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
            void Promise.all([
                utils.provider.listModels.invalidate({
                    profileId: input.profileId,
                    providerId: input.selectedProviderId ?? 'openai',
                }),
                utils.provider.getDefaults.invalidate({ profileId: input.profileId }),
            ]);
        },
    });

    const setModelRoutingPreferenceMutation = trpc.provider.setModelRoutingPreference.useMutation({
        onSuccess: ({ preference }) => {
            void utils.provider.getModelRoutingPreference.setData(
                {
                    profileId: input.profileId,
                    providerId: 'kilo',
                    modelId: preference.modelId,
                },
                {
                    preference,
                }
            );
            void utils.provider.listModelProviders.invalidate({ profileId: input.profileId });
        },
    });

    const setOrganizationMutation = trpc.provider.setOrganization.useMutation({
        onSuccess: () => {
            input.setStatusMessage('Kilo organization updated.');
            void Promise.all([
                utils.provider.getAccountContext.invalidate({
                    profileId: input.profileId,
                    providerId: 'kilo',
                }),
                utils.provider.getAuthState.invalidate({
                    profileId: input.profileId,
                    providerId: 'kilo',
                }),
                utils.provider.listProviders.invalidate({ profileId: input.profileId }),
                utils.provider.getDefaults.invalidate({ profileId: input.profileId }),
                utils.provider.listModels.invalidate({
                    profileId: input.profileId,
                    providerId: input.selectedProviderId ?? 'kilo',
                }),
            ]);
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
            void Promise.all([
                utils.provider.getAuthState.invalidate({
                    profileId: input.profileId,
                    providerId: variables.providerId,
                }),
                utils.provider.listProviders.invalidate({ profileId: input.profileId }),
            ]);
            if (variables.providerId === 'openai') {
                void utils.provider.getOpenAISubscriptionRateLimits.invalidate({ profileId: input.profileId });
            }
        },
    });

    const pollAuthMutation = trpc.provider.pollAuth.useMutation({
        onSuccess: (result, variables) => {
            if (result.flow.status === 'pending') {
                input.setStatusMessage('Waiting for authorization confirmation...');
                return;
            }

            input.setStatusMessage(`Auth flow ${result.flow.status}. State: ${result.state.authState}.`);
            input.setActiveAuthFlow(undefined);
            void utils.provider.getAuthState.setData(
                {
                    profileId: input.profileId,
                    providerId: variables.providerId,
                },
                {
                    found: true,
                    state: result.state,
                }
            );
            void utils.provider.listProviders.invalidate({ profileId: input.profileId });
            if (variables.providerId === 'kilo') {
                void utils.provider.getAccountContext.invalidate({
                    profileId: input.profileId,
                    providerId: 'kilo',
                });
            }
            if (variables.providerId === 'openai') {
                void utils.provider.getOpenAISubscriptionRateLimits.invalidate({ profileId: input.profileId });
            }
        },
    });

    const cancelAuthMutation = trpc.provider.cancelAuth.useMutation({
        onSuccess: () => {
            input.setStatusMessage('Auth flow cancelled.');
            input.setActiveAuthFlow(undefined);
            void Promise.all([
                utils.provider.getAuthState.invalidate({
                    profileId: input.profileId,
                    providerId: input.selectedProviderId ?? 'openai',
                }),
                utils.provider.listProviders.invalidate({ profileId: input.profileId }),
            ]);
            if (input.selectedProviderId === 'openai') {
                void utils.provider.getOpenAISubscriptionRateLimits.invalidate({ profileId: input.profileId });
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
