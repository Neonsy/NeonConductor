import { useEffect, useState } from 'react';

import { createProviderSettingsActions } from '@/web/components/settings/providerSettings/hooks/providerSettingsActions';
import { createProviderSettingsRefetchers } from '@/web/components/settings/providerSettings/hooks/providerSettingsRefetch';
import { resetProviderSettingsState } from '@/web/components/settings/providerSettings/hooks/providerSettingsState';
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
        resetProviderSettingsState({
            setActiveAuthFlow,
            setApiKeyInput,
            setStatusMessage,
        });
    }, [profileId]);

    useEffect(() => {
        const nextProviderId = resolveSelectedProviderId(providers, selectedProviderId);
        if (nextProviderId && nextProviderId !== selectedProviderId) {
            setSelectedProviderId(nextProviderId);
        }
    }, [providers, selectedProviderId]);

    const refetchers = createProviderSettingsRefetchers(queries);
    const mutations = useProviderSettingsMutations({
        profileId,
        selectedProviderId,
        setStatusMessage,
        setApiKeyInput,
        setActiveAuthFlow,
        ...refetchers,
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

    const { kiloRoutingDraft } = useKiloRoutingDraft({
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
    const actions = createProviderSettingsActions({
        profileId,
        selectedProviderId,
        selectedModelId,
        apiKeyInput,
        activeAuthFlow,
        kiloModelProviderIds: kiloModelProviders.map((provider) => provider.providerId),
        kiloRoutingDraft,
        setSelectedProviderId,
        setStatusMessage,
        mutations,
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
        ...actions,
        setSelectedModelId,
        setApiKeyInput,
        setStatusMessage,
    };
}
