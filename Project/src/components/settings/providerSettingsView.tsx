import { useEffect, useMemo, useState } from 'react';

import { ProviderAuthenticationSection } from '@/web/components/settings/providerSettings/authenticationSection';
import { ProviderDefaultModelSection } from '@/web/components/settings/providerSettings/defaultModelSection';
import { isProviderId, methodLabel } from '@/web/components/settings/providerSettings/helpers';
import { KiloRoutingSection } from '@/web/components/settings/providerSettings/kiloRoutingSection';
import {
    OpenAIAccountLimitsSection,
    OpenAILocalUsageSection,
} from '@/web/components/settings/providerSettings/openAISections';
import { ProviderSidebar } from '@/web/components/settings/providerSettings/providerSidebar';
import type {
    ActiveAuthFlow,
    KiloRoutingDraft,
    ProviderAuthStateView,
    ProviderListItem,
} from '@/web/components/settings/providerSettings/types';
import { trpc } from '@/web/trpc/client';

import type { RuntimeProviderId } from '@/app/backend/runtime/contracts';

interface ProviderSettingsViewProps {
    profileId: string;
}

export function ProviderSettingsView({ profileId }: ProviderSettingsViewProps) {
    const providersQuery = trpc.provider.listProviders.useQuery({ profileId }, { refetchOnWindowFocus: false });
    const authMethodsQuery = trpc.provider.listAuthMethods.useQuery({ profileId }, { refetchOnWindowFocus: false });
    const snapshotQuery = trpc.runtime.getSnapshot.useQuery({ profileId }, { refetchOnWindowFocus: false });

    const providers = providersQuery.data?.providers ?? [];
    const defaults = snapshotQuery.data?.defaults;
    const providerItems: ProviderListItem[] = providers;

    const [selectedProviderId, setSelectedProviderId] = useState<RuntimeProviderId | undefined>(undefined);
    const [selectedModelId, setSelectedModelId] = useState<string>('');
    const [apiKeyInput, setApiKeyInput] = useState('');
    const [activeAuthFlow, setActiveAuthFlow] = useState<ActiveAuthFlow | undefined>(undefined);
    const [statusMessage, setStatusMessage] = useState<string | undefined>(undefined);
    const [kiloRoutingDraft, setKiloRoutingDraft] = useState<KiloRoutingDraft | undefined>(undefined);

    useEffect(() => {
        setActiveAuthFlow(undefined);
        setApiKeyInput('');
        setStatusMessage(undefined);
    }, [profileId]);

    useEffect(() => {
        if (selectedProviderId && providers.some((provider) => provider.id === selectedProviderId)) {
            return;
        }

        const fallbackProvider = providers.find((provider) => provider.isDefault)?.id ?? providers[0]?.id;
        if (fallbackProvider) {
            setSelectedProviderId(fallbackProvider);
        }
    }, [providers, selectedProviderId]);

    const selectedProvider = providers.find((provider) => provider.id === selectedProviderId);

    const listModelsQuery = trpc.provider.listModels.useQuery(
        {
            profileId,
            providerId: selectedProviderId ?? 'openai',
        },
        {
            enabled: Boolean(selectedProviderId),
            refetchOnWindowFocus: false,
        }
    );

    const authStateQuery = trpc.provider.getAuthState.useQuery(
        {
            profileId,
            providerId: selectedProviderId ?? 'openai',
        },
        {
            enabled: Boolean(selectedProviderId),
            refetchOnWindowFocus: false,
        }
    );

    const kiloRoutingPreferenceQuery = trpc.provider.getModelRoutingPreference.useQuery(
        {
            profileId,
            providerId: 'kilo',
            modelId: selectedModelId,
        },
        {
            enabled: selectedProviderId === 'kilo' && selectedModelId.trim().length > 0,
            refetchOnWindowFocus: false,
        }
    );

    const kiloModelProvidersQuery = trpc.provider.listModelProviders.useQuery(
        {
            profileId,
            providerId: 'kilo',
            modelId: selectedModelId,
        },
        {
            enabled: selectedProviderId === 'kilo' && selectedModelId.trim().length > 0,
            refetchOnWindowFocus: false,
        }
    );

    const accountContextQuery = trpc.provider.getAccountContext.useQuery(
        {
            profileId,
            providerId: selectedProviderId ?? 'kilo',
        },
        {
            enabled: selectedProviderId === 'kilo',
            refetchOnWindowFocus: false,
        }
    );

    const openAISubscriptionUsageQuery = trpc.provider.getOpenAISubscriptionUsage.useQuery(
        {
            profileId,
        },
        {
            enabled: selectedProviderId === 'openai',
            refetchOnWindowFocus: false,
        }
    );

    const openAISubscriptionRateLimitsQuery = trpc.provider.getOpenAISubscriptionRateLimits.useQuery(
        {
            profileId,
        },
        {
            enabled: selectedProviderId === 'openai',
            refetchOnWindowFocus: false,
        }
    );

    const setDefaultMutation = trpc.provider.setDefault.useMutation({
        onSuccess: (result) => {
            if (!result.success) {
                setStatusMessage(
                    result.reason === 'model_not_found' ? 'Selected model is not available.' : 'Default update failed.'
                );
                return;
            }

            setStatusMessage('Default provider/model updated.');
            void providersQuery.refetch();
            void snapshotQuery.refetch();
        },
    });

    const setApiKeyMutation = trpc.provider.setApiKey.useMutation({
        onSuccess: (result) => {
            if (!result.success) {
                setStatusMessage('Provider not found.');
                return;
            }

            setApiKeyInput('');
            setStatusMessage('API key saved. Provider is ready.');
            void providersQuery.refetch();
            void authStateQuery.refetch();
            if (selectedProviderId === 'openai') {
                void openAISubscriptionRateLimitsQuery.refetch();
            }
        },
    });

    const syncCatalogMutation = trpc.provider.syncCatalog.useMutation({
        onSuccess: (result) => {
            if (!result.ok) {
                setStatusMessage(result.reason ? `Catalog sync failed: ${result.reason}` : 'Catalog sync failed.');
                return;
            }

            setStatusMessage(`Catalog synced (${String(result.modelCount)} models).`);
            void listModelsQuery.refetch();
            void snapshotQuery.refetch();
        },
    });

    const setModelRoutingPreferenceMutation = trpc.provider.setModelRoutingPreference.useMutation({
        onSuccess: () => {
            void kiloRoutingPreferenceQuery.refetch();
            void kiloModelProvidersQuery.refetch();
        },
    });

    const startAuthMutation = trpc.provider.startAuth.useMutation({
        onSuccess: (result, variables) => {
            setStatusMessage(`${methodLabel(variables.method)} flow started.`);
            setActiveAuthFlow({
                providerId: variables.providerId,
                flowId: result.flow.id,
                ...(result.userCode ? { userCode: result.userCode } : {}),
                ...(result.verificationUri ? { verificationUri: result.verificationUri } : {}),
                pollAfterSeconds: result.pollAfterSeconds ?? 5,
            });
            void authStateQuery.refetch();
            void providersQuery.refetch();
            if (variables.providerId === 'openai') {
                void openAISubscriptionRateLimitsQuery.refetch();
            }
        },
    });

    const pollAuthMutation = trpc.provider.pollAuth.useMutation({
        onSuccess: (result) => {
            if (result.flow.status === 'pending') {
                setStatusMessage('Waiting for authorization confirmation...');
                return;
            }

            setStatusMessage(`Auth flow ${result.flow.status}. State: ${result.state.authState}.`);
            setActiveAuthFlow(undefined);
            void authStateQuery.refetch();
            void providersQuery.refetch();
            if (selectedProviderId === 'kilo') {
                void accountContextQuery.refetch();
            }
            if (selectedProviderId === 'openai') {
                void openAISubscriptionRateLimitsQuery.refetch();
            }
        },
    });

    const cancelAuthMutation = trpc.provider.cancelAuth.useMutation({
        onSuccess: () => {
            setStatusMessage('Auth flow cancelled.');
            setActiveAuthFlow(undefined);
            void authStateQuery.refetch();
            void providersQuery.refetch();
            if (selectedProviderId === 'openai') {
                void openAISubscriptionRateLimitsQuery.refetch();
            }
        },
    });

    useEffect(() => {
        if (!activeAuthFlow || pollAuthMutation.isPending) {
            return;
        }

        const timer = window.setTimeout(
            () => {
                void pollAuthMutation.mutateAsync({
                    profileId,
                    providerId: activeAuthFlow.providerId,
                    flowId: activeAuthFlow.flowId,
                });
            },
            Math.max(1, activeAuthFlow.pollAfterSeconds) * 1000
        );

        return () => {
            window.clearTimeout(timer);
        };
    }, [activeAuthFlow, pollAuthMutation, profileId]);

    const authMethodMap = useMemo(() => {
        const map = new Map<RuntimeProviderId, string[]>();
        for (const entry of authMethodsQuery.data?.methods ?? []) {
            if (isProviderId(entry.providerId)) {
                map.set(entry.providerId, entry.methods);
            }
        }

        return map;
    }, [authMethodsQuery.data?.methods]);

    const methods = selectedProviderId ? (authMethodMap.get(selectedProviderId) ?? []) : [];
    const models = listModelsQuery.data?.models ?? [];
    const kiloModelProviders = kiloModelProvidersQuery.data?.providers ?? [];

    useEffect(() => {
        if (!selectedProviderId) {
            return;
        }

        if (selectedModelId && models.some((model) => model.id === selectedModelId)) {
            return;
        }

        if (defaults?.providerId === selectedProviderId && models.some((model) => model.id === defaults.modelId)) {
            setSelectedModelId(defaults.modelId);
            return;
        }

        setSelectedModelId(models[0]?.id ?? '');
    }, [defaults?.modelId, defaults?.providerId, models, selectedModelId, selectedProviderId]);

    const selectedAuthState: ProviderAuthStateView | undefined = authStateQuery.data?.found
        ? authStateQuery.data.state
        : undefined;
    const selectedIsDefaultProvider = defaults?.providerId === selectedProviderId;
    const selectedIsDefaultModel = selectedIsDefaultProvider && defaults?.modelId === selectedModelId;
    const openAISubscriptionUsage = openAISubscriptionUsageQuery.data?.usage;
    const openAISubscriptionRateLimits = openAISubscriptionRateLimitsQuery.data?.rateLimits;

    useEffect(() => {
        if (selectedProviderId !== 'kilo' || selectedModelId.trim().length === 0) {
            setKiloRoutingDraft(undefined);
            return;
        }

        const preference = kiloRoutingPreferenceQuery.data?.preference;
        if (!preference) {
            setKiloRoutingDraft({
                routingMode: 'dynamic',
                sort: 'default',
                pinnedProviderId: '',
            });
            return;
        }

        if (preference.routingMode === 'dynamic') {
            setKiloRoutingDraft({
                routingMode: 'dynamic',
                sort: preference.sort ?? 'default',
                pinnedProviderId: '',
            });
            return;
        }

        setKiloRoutingDraft({
            routingMode: 'pinned',
            sort: 'default',
            pinnedProviderId: preference.pinnedProviderId ?? '',
        });
    }, [kiloRoutingPreferenceQuery.data?.preference, selectedModelId, selectedProviderId]);

    const saveKiloRoutingPreference = async (nextDraft: KiloRoutingDraft): Promise<void> => {
        if (selectedProviderId !== 'kilo' || selectedModelId.trim().length === 0) {
            return;
        }

        const previousDraft = kiloRoutingDraft;
        setKiloRoutingDraft(nextDraft);

        try {
            if (nextDraft.routingMode === 'dynamic') {
                await setModelRoutingPreferenceMutation.mutateAsync({
                    profileId,
                    providerId: 'kilo',
                    modelId: selectedModelId,
                    routingMode: 'dynamic',
                    sort: nextDraft.sort,
                });
            } else {
                if (nextDraft.pinnedProviderId.trim().length === 0) {
                    setStatusMessage('Select a provider before enabling pinned routing.');
                    setKiloRoutingDraft(previousDraft);
                    return;
                }

                await setModelRoutingPreferenceMutation.mutateAsync({
                    profileId,
                    providerId: 'kilo',
                    modelId: selectedModelId,
                    routingMode: 'pinned',
                    pinnedProviderId: nextDraft.pinnedProviderId,
                });
            }

            setStatusMessage('Kilo routing preference saved.');
        } catch {
            setStatusMessage('Failed to save Kilo routing preference.');
            setKiloRoutingDraft(previousDraft);
        }
    };

    return (
        <section className='grid min-h-full grid-cols-[260px_1fr]'>
            <ProviderSidebar
                providers={providerItems}
                selectedProviderId={selectedProviderId}
                onSelectProvider={(providerId) => {
                    setStatusMessage(undefined);
                    setSelectedProviderId(providerId);
                }}
            />

            <div className='min-h-0 overflow-y-auto p-4'>
                {selectedProvider ? (
                    <div className='space-y-5'>
                        <div>
                            <h4 className='text-base font-semibold'>{selectedProvider.label}</h4>
                            <p className='text-muted-foreground text-xs'>
                                Local runtime works with any configured provider. Kilo login is only required for
                                Kilo-specific extras.
                            </p>
                            {statusMessage ? <p className='text-primary mt-2 text-xs'>{statusMessage}</p> : null}
                        </div>

                        <ProviderDefaultModelSection
                            selectedProviderId={selectedProviderId}
                            selectedModelId={selectedModelId}
                            models={models}
                            isDefaultModel={selectedIsDefaultModel}
                            isSavingDefault={setDefaultMutation.isPending}
                            isSyncingCatalog={syncCatalogMutation.isPending}
                            onSelectModel={setSelectedModelId}
                            onSetDefault={() => {
                                if (!selectedProviderId || !selectedModelId) {
                                    return;
                                }

                                void setDefaultMutation.mutateAsync({
                                    profileId,
                                    providerId: selectedProviderId,
                                    modelId: selectedModelId,
                                });
                            }}
                            onSyncCatalog={() => {
                                if (!selectedProviderId) {
                                    return;
                                }

                                void syncCatalogMutation.mutateAsync({
                                    profileId,
                                    providerId: selectedProviderId,
                                    force: true,
                                });
                            }}
                        />

                        {selectedProvider.id === 'kilo' && selectedModelId.trim().length > 0 && kiloRoutingDraft ? (
                            <KiloRoutingSection
                                selectedModelId={selectedModelId}
                                draft={kiloRoutingDraft}
                                providers={kiloModelProviders}
                                isLoadingPreference={kiloRoutingPreferenceQuery.isLoading}
                                isLoadingProviders={kiloModelProvidersQuery.isLoading}
                                isSaving={setModelRoutingPreferenceMutation.isPending}
                                onModeChange={(mode) => {
                                    if (mode === 'dynamic') {
                                        void saveKiloRoutingPreference({
                                            routingMode: 'dynamic',
                                            sort: kiloRoutingDraft.sort,
                                            pinnedProviderId: '',
                                        });
                                        return;
                                    }

                                    const pinnedProviderId =
                                        kiloRoutingDraft.pinnedProviderId || kiloModelProviders[0]?.providerId || '';
                                    if (!pinnedProviderId) {
                                        setStatusMessage('No available providers to pin for this model.');
                                        return;
                                    }

                                    void saveKiloRoutingPreference({
                                        routingMode: 'pinned',
                                        sort: 'default',
                                        pinnedProviderId,
                                    });
                                }}
                                onSortChange={(sort) => {
                                    void saveKiloRoutingPreference({
                                        routingMode: 'dynamic',
                                        sort,
                                        pinnedProviderId: '',
                                    });
                                }}
                                onPinnedProviderChange={(providerId) => {
                                    if (providerId.trim().length === 0) {
                                        return;
                                    }

                                    void saveKiloRoutingPreference({
                                        routingMode: 'pinned',
                                        sort: 'default',
                                        pinnedProviderId: providerId,
                                    });
                                }}
                            />
                        ) : null}

                        <ProviderAuthenticationSection
                            selectedProviderId={selectedProviderId}
                            selectedProviderAuthState={selectedProvider.authState}
                            selectedProviderAuthMethod={selectedProvider.authMethod}
                            selectedAuthState={selectedAuthState}
                            methods={methods}
                            apiKeyInput={apiKeyInput}
                            activeAuthFlow={activeAuthFlow}
                            isSavingApiKey={setApiKeyMutation.isPending}
                            isStartingAuth={startAuthMutation.isPending}
                            isPollingAuth={pollAuthMutation.isPending}
                            isCancellingAuth={cancelAuthMutation.isPending}
                            onApiKeyInputChange={setApiKeyInput}
                            onSaveApiKey={() => {
                                if (!selectedProviderId) {
                                    return;
                                }

                                void setApiKeyMutation.mutateAsync({
                                    profileId,
                                    providerId: selectedProviderId,
                                    apiKey: apiKeyInput.trim(),
                                });
                            }}
                            onStartOAuthDevice={() => {
                                if (!selectedProviderId) {
                                    return;
                                }

                                void startAuthMutation.mutateAsync({
                                    profileId,
                                    providerId: selectedProviderId,
                                    method: 'oauth_device',
                                });
                            }}
                            onStartDeviceCode={() => {
                                if (!selectedProviderId) {
                                    return;
                                }

                                void startAuthMutation.mutateAsync({
                                    profileId,
                                    providerId: selectedProviderId,
                                    method: 'device_code',
                                });
                            }}
                            onPollNow={() => {
                                if (!activeAuthFlow) {
                                    return;
                                }

                                void pollAuthMutation.mutateAsync({
                                    profileId,
                                    providerId: activeAuthFlow.providerId,
                                    flowId: activeAuthFlow.flowId,
                                });
                            }}
                            onCancelFlow={() => {
                                if (!activeAuthFlow) {
                                    return;
                                }

                                void cancelAuthMutation.mutateAsync({
                                    profileId,
                                    providerId: activeAuthFlow.providerId,
                                    flowId: activeAuthFlow.flowId,
                                });
                            }}
                        />

                        {selectedProvider.id === 'kilo' ? (
                            <section className='space-y-1'>
                                <p className='text-sm font-semibold'>Kilo Extras</p>
                                <p className='text-muted-foreground text-xs'>
                                    Cloud sessions and marketplace remain Kilo-gated and unlock after Kilo login.
                                </p>
                                <p className='text-muted-foreground text-xs'>
                                    Account state:{' '}
                                    {accountContextQuery.data?.authState.authState ?? selectedProvider.authState}
                                </p>
                            </section>
                        ) : null}

                        {selectedProvider.id === 'openai' ? (
                            <OpenAIAccountLimitsSection
                                isLoading={openAISubscriptionRateLimitsQuery.isLoading}
                                rateLimits={openAISubscriptionRateLimits}
                            />
                        ) : null}

                        {selectedProvider.id === 'openai' ? (
                            <OpenAILocalUsageSection
                                isLoading={openAISubscriptionUsageQuery.isLoading}
                                usage={openAISubscriptionUsage}
                            />
                        ) : null}
                    </div>
                ) : (
                    <p className='text-muted-foreground text-sm'>No providers available.</p>
                )}
            </div>
        </section>
    );
}
