import { resolvePinnedProviderId, selectProviderWithReset } from '@/web/components/settings/providerSettings/hooks/providerSettingsState';
import type { ActiveAuthFlow } from '@/web/components/settings/providerSettings/types';

import type { RuntimeProviderId } from '@/app/backend/runtime/contracts';

export function createProviderSettingsActions(input: {
    profileId: string;
    selectedProviderId: RuntimeProviderId | undefined;
    selectedModelId: string;
    apiKeyInput: string;
    activeAuthFlow: ActiveAuthFlow | undefined;
    kiloModelProviderIds: string[];
    kiloRoutingDraft:
        | {
              sort: 'default' | 'price' | 'throughput' | 'latency';
              pinnedProviderId: string;
          }
        | undefined;
    setSelectedProviderId: (value: RuntimeProviderId) => void;
    setStatusMessage: (value: string | undefined) => void;
    mutations: {
        setDefaultMutation: { mutateAsync: (input: { profileId: string; providerId: RuntimeProviderId; modelId: string }) => Promise<unknown> };
        syncCatalogMutation: { mutateAsync: (input: { profileId: string; providerId: RuntimeProviderId; force: boolean }) => Promise<unknown> };
        setModelRoutingPreferenceMutation: {
            mutateAsync: (input: {
                profileId: string;
                providerId: 'kilo';
                modelId: string;
                routingMode: 'dynamic' | 'pinned';
                sort?: 'default' | 'price' | 'throughput' | 'latency';
                pinnedProviderId?: string;
            }) => Promise<unknown>;
        };
        setEndpointProfileMutation: {
            mutateAsync: (input: { profileId: string; providerId: RuntimeProviderId; value: string }) => Promise<unknown>;
        };
        setApiKeyMutation: {
            mutateAsync: (input: { profileId: string; providerId: RuntimeProviderId; apiKey: string }) => Promise<unknown>;
        };
        startAuthMutation: {
            mutateAsync: (input: {
                profileId: string;
                providerId: RuntimeProviderId;
                method: 'oauth_device' | 'device_code';
            }) => Promise<unknown>;
        };
        pollAuthMutation: {
            mutateAsync: (input: { profileId: string; providerId: RuntimeProviderId; flowId: string }) => Promise<unknown>;
        };
        cancelAuthMutation: {
            mutateAsync: (input: { profileId: string; providerId: RuntimeProviderId; flowId: string }) => Promise<unknown>;
        };
    };
}) {
    const saveKiloRoutingPreference = async (inputValue: {
        routingMode: 'dynamic' | 'pinned';
        sort?: 'default' | 'price' | 'throughput' | 'latency';
        pinnedProviderId?: string;
    }) => {
        if (!input.selectedModelId.trim()) {
            return;
        }

        await input.mutations.setModelRoutingPreferenceMutation.mutateAsync({
            profileId: input.profileId,
            providerId: 'kilo',
            modelId: input.selectedModelId,
            ...inputValue,
        });
    };

    return {
        selectProvider: (providerId: RuntimeProviderId) => {
            selectProviderWithReset({
                providerId,
                setSelectedProviderId: input.setSelectedProviderId,
                setStatusMessage: input.setStatusMessage,
            });
        },
        setDefaultModel: async () => {
            if (!input.selectedProviderId || !input.selectedModelId) {
                return;
            }

            await input.mutations.setDefaultMutation.mutateAsync({
                profileId: input.profileId,
                providerId: input.selectedProviderId,
                modelId: input.selectedModelId,
            });
        },
        syncCatalog: async () => {
            if (!input.selectedProviderId) {
                return;
            }

            await input.mutations.syncCatalogMutation.mutateAsync({
                profileId: input.profileId,
                providerId: input.selectedProviderId,
                force: true,
            });
        },
        changeRoutingMode: async (mode: 'dynamic' | 'pinned') => {
            if (!input.kiloRoutingDraft) {
                return;
            }

            if (mode === 'dynamic') {
                await saveKiloRoutingPreference({
                    routingMode: 'dynamic',
                    sort: input.kiloRoutingDraft.sort,
                    pinnedProviderId: '',
                });
                return;
            }

            const pinnedProviderId = resolvePinnedProviderId({
                pinnedProviderId: input.kiloRoutingDraft.pinnedProviderId,
                availableProviderIds: input.kiloModelProviderIds,
            });
            if (!pinnedProviderId) {
                input.setStatusMessage('No available providers to pin for this model.');
                return;
            }

            await saveKiloRoutingPreference({
                routingMode: 'pinned',
                sort: 'default',
                pinnedProviderId,
            });
        },
        changeRoutingSort: async (sort: 'default' | 'price' | 'throughput' | 'latency') => {
            await saveKiloRoutingPreference({
                routingMode: 'dynamic',
                sort,
                pinnedProviderId: '',
            });
        },
        changePinnedProvider: async (providerId: string) => {
            if (providerId.trim().length === 0) {
                return;
            }

            await saveKiloRoutingPreference({
                routingMode: 'pinned',
                sort: 'default',
                pinnedProviderId: providerId,
            });
        },
        changeEndpointProfile: async (value: string) => {
            if (!input.selectedProviderId) {
                return;
            }

            await input.mutations.setEndpointProfileMutation.mutateAsync({
                profileId: input.profileId,
                providerId: input.selectedProviderId,
                value,
            });
        },
        saveApiKey: async () => {
            if (!input.selectedProviderId) {
                return;
            }

            await input.mutations.setApiKeyMutation.mutateAsync({
                profileId: input.profileId,
                providerId: input.selectedProviderId,
                apiKey: input.apiKeyInput.trim(),
            });
        },
        startOAuthDevice: async () => {
            if (!input.selectedProviderId) {
                return;
            }

            await input.mutations.startAuthMutation.mutateAsync({
                profileId: input.profileId,
                providerId: input.selectedProviderId,
                method: 'oauth_device',
            });
        },
        startDeviceCode: async () => {
            if (!input.selectedProviderId) {
                return;
            }

            await input.mutations.startAuthMutation.mutateAsync({
                profileId: input.profileId,
                providerId: input.selectedProviderId,
                method: 'device_code',
            });
        },
        pollNow: async () => {
            if (!input.activeAuthFlow) {
                return;
            }

            await input.mutations.pollAuthMutation.mutateAsync({
                profileId: input.profileId,
                providerId: input.activeAuthFlow.providerId,
                flowId: input.activeAuthFlow.flowId,
            });
        },
        cancelFlow: async () => {
            if (!input.activeAuthFlow) {
                return;
            }

            await input.mutations.cancelAuthMutation.mutateAsync({
                profileId: input.profileId,
                providerId: input.activeAuthFlow.providerId,
                flowId: input.activeAuthFlow.flowId,
            });
        },
    };
}
