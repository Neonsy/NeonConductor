import { useEffect, useState } from 'react';

import { useKiloRoutingDraft } from '@/web/components/settings/providerSettings/hooks/useKiloRoutingDraft';
import { useProviderSettingsAuthPolling } from '@/web/components/settings/providerSettings/hooks/useProviderSettingsAuthPolling';
import { useProviderSettingsMutations } from '@/web/components/settings/providerSettings/hooks/useProviderSettingsMutations';
import { useProviderSettingsQueries } from '@/web/components/settings/providerSettings/hooks/useProviderSettingsQueries';
import { resolveSelectedModelId, resolveSelectedProviderId } from '@/web/components/settings/providerSettings/selection';
import type {
    ActiveAuthFlow,
    ProviderAuthStateView,
    ProviderListItem,
} from '@/web/components/settings/providerSettings/types';

import type { RuntimeProviderId } from '@/app/backend/runtime/contracts';

export function useProviderSettingsController(profileId: string) {
    const [selectedProviderId, setSelectedProviderId] = useState<RuntimeProviderId | undefined>(undefined);
    const [selectedModelId, setSelectedModelId] = useState('');
    const [apiKeyInput, setApiKeyInput] = useState('');
    const [activeAuthFlow, setActiveAuthFlow] = useState<ActiveAuthFlow | undefined>(undefined);
    const [statusMessage, setStatusMessage] = useState<string | undefined>(undefined);

    const queries = useProviderSettingsQueries({
        profileId,
        selectedProviderId,
        selectedModelId,
    });
    const providers = queries.providersQuery.data?.providers ?? [];
    const defaults = queries.defaultsQuery.data?.defaults;
    const providerItems: ProviderListItem[] = providers;
    const selectedProvider = providers.find((provider) => provider.id === selectedProviderId);
    const models = queries.listModelsQuery.data?.models ?? [];
    const kiloModelProviders = queries.kiloModelProvidersQuery.data?.providers ?? [];

    useEffect(() => {
        setActiveAuthFlow(undefined);
        setApiKeyInput('');
        setStatusMessage(undefined);
    }, [profileId]);

    useEffect(() => {
        const nextProviderId = resolveSelectedProviderId(providers, selectedProviderId);
        if (nextProviderId && nextProviderId !== selectedProviderId) {
            setSelectedProviderId(nextProviderId);
        }
    }, [providers, selectedProviderId]);

    const mutations = useProviderSettingsMutations({
        profileId,
        selectedProviderId,
        setStatusMessage,
        setApiKeyInput,
        setActiveAuthFlow,
        refetchProviders: () => {
            void queries.providersQuery.refetch();
        },
        refetchDefaults: () => {
            void queries.defaultsQuery.refetch();
        },
        refetchAuthState: () => {
            void queries.authStateQuery.refetch();
        },
        refetchListModels: () => {
            void queries.listModelsQuery.refetch();
        },
        refetchKiloRoutingPreference: () => {
            void queries.kiloRoutingPreferenceQuery.refetch();
        },
        refetchKiloModelProviders: () => {
            void queries.kiloModelProvidersQuery.refetch();
        },
        refetchAccountContext: () => {
            void queries.accountContextQuery.refetch();
        },
        refetchOpenAIRateLimits: () => {
            void queries.openAISubscriptionRateLimitsQuery.refetch();
        },
    });

    useProviderSettingsAuthPolling({
        profileId,
        activeAuthFlow,
        isPolling: mutations.pollAuthMutation.isPending,
        pollAuth: async (payload) => mutations.pollAuthMutation.mutateAsync(payload),
    });

    useEffect(() => {
        const nextModelId = resolveSelectedModelId({
            selectedProviderId,
            selectedModelId,
            models,
            defaults,
        });
        if (nextModelId !== selectedModelId) {
            setSelectedModelId(nextModelId);
        }
    }, [defaults, models, selectedModelId, selectedProviderId]);

    const selectedAuthState: ProviderAuthStateView | undefined = queries.authStateQuery.data?.found
        ? queries.authStateQuery.data.state
        : undefined;
    const selectedIsDefaultProvider = defaults?.providerId === selectedProviderId;
    const selectedIsDefaultModel = selectedIsDefaultProvider && defaults?.modelId === selectedModelId;
    const openAISubscriptionUsage = queries.openAISubscriptionUsageQuery.data?.usage;
    const openAISubscriptionRateLimits = queries.openAISubscriptionRateLimitsQuery.data?.rateLimits;

    const { kiloRoutingDraft, saveKiloRoutingPreference } = useKiloRoutingDraft({
        profileId,
        selectedProviderId,
        selectedModelId,
        preference: queries.kiloRoutingPreferenceQuery.data?.preference,
        providerOptions: kiloModelProviders,
        setStatusMessage,
        savePreference: async (saveInput) => {
            await mutations.setModelRoutingPreferenceMutation.mutateAsync(saveInput);
        },
    });

    return {
        selectedProviderId,
        selectedModelId,
        apiKeyInput,
        activeAuthFlow,
        statusMessage,
        providerItems,
        selectedProvider,
        models,
        methods: selectedProvider?.availableAuthMethods ?? [],
        kiloModelProviders,
        selectedAuthState,
        selectedIsDefaultModel,
        openAISubscriptionUsage,
        openAISubscriptionRateLimits,
        kiloRoutingDraft,
        queries,
        mutations,
        selectProvider: (providerId: RuntimeProviderId) => {
            setStatusMessage(undefined);
            setSelectedProviderId(providerId);
        },
        setSelectedModelId,
        setApiKeyInput,
        setStatusMessage,
        setDefaultModel: async () => {
            if (!selectedProviderId || !selectedModelId) {
                return;
            }

            await mutations.setDefaultMutation.mutateAsync({
                profileId,
                providerId: selectedProviderId,
                modelId: selectedModelId,
            });
        },
        syncCatalog: async () => {
            if (!selectedProviderId) {
                return;
            }

            await mutations.syncCatalogMutation.mutateAsync({
                profileId,
                providerId: selectedProviderId,
                force: true,
            });
        },
        changeRoutingMode: async (mode: 'dynamic' | 'pinned') => {
            if (!kiloRoutingDraft) {
                return;
            }

            if (mode === 'dynamic') {
                await saveKiloRoutingPreference({
                    routingMode: 'dynamic',
                    sort: kiloRoutingDraft.sort,
                    pinnedProviderId: '',
                });
                return;
            }

            const pinnedProviderId = kiloRoutingDraft.pinnedProviderId || kiloModelProviders[0]?.providerId || '';
            if (!pinnedProviderId) {
                setStatusMessage('No available providers to pin for this model.');
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
            if (!selectedProviderId) {
                return;
            }

            await mutations.setEndpointProfileMutation.mutateAsync({
                profileId,
                providerId: selectedProviderId,
                value,
            });
        },
        saveApiKey: async () => {
            if (!selectedProviderId) {
                return;
            }

            await mutations.setApiKeyMutation.mutateAsync({
                profileId,
                providerId: selectedProviderId,
                apiKey: apiKeyInput.trim(),
            });
        },
        startOAuthDevice: async () => {
            if (!selectedProviderId) {
                return;
            }

            await mutations.startAuthMutation.mutateAsync({
                profileId,
                providerId: selectedProviderId,
                method: 'oauth_device',
            });
        },
        startDeviceCode: async () => {
            if (!selectedProviderId) {
                return;
            }

            await mutations.startAuthMutation.mutateAsync({
                profileId,
                providerId: selectedProviderId,
                method: 'device_code',
            });
        },
        pollNow: async () => {
            if (!activeAuthFlow) {
                return;
            }

            await mutations.pollAuthMutation.mutateAsync({
                profileId,
                providerId: activeAuthFlow.providerId,
                flowId: activeAuthFlow.flowId,
            });
        },
        cancelFlow: async () => {
            if (!activeAuthFlow) {
                return;
            }

            await mutations.cancelAuthMutation.mutateAsync({
                profileId,
                providerId: activeAuthFlow.providerId,
                flowId: activeAuthFlow.flowId,
            });
        },
    };
}
