import { useState } from 'react';

import { buildModelPickerOption } from '@/web/components/modelSelection/modelCapabilities';
import type { ModelPickerOption } from '@/web/components/modelSelection/modelCapabilities';
import { createProfilePreferencesActions } from '@/web/components/settings/profileSettings/actions';
import type { ProfileSelectionState } from '@/web/components/settings/profileSettings/useProfileSelectionState';
import { createFailClosedAsyncAction } from '@/web/lib/async/createFailClosedAsyncAction';
import { PROGRESSIVE_QUERY_OPTIONS } from '@/web/lib/query/progressiveQueryOptions';
import { findProviderControlEntry, listProviderControlProviders } from '@/web/lib/providerControl/selectors';
import { trpc } from '@/web/trpc/client';

import type { RuntimeProviderId } from '@/shared/contracts';
import type { ProviderEmbeddingControlSnapshot } from '@/app/backend/providers/service/types';

function listProviderEmbeddingControlProviders(
    snapshot: ProviderEmbeddingControlSnapshot | undefined
): Array<{ id: RuntimeProviderId; label: string }> {
    return (snapshot?.entries ?? []).map((entry) => ({
        id: entry.provider.id,
        label: entry.provider.label,
    }));
}

function findProviderEmbeddingControlEntry(
    snapshot: ProviderEmbeddingControlSnapshot | undefined,
    providerId: RuntimeProviderId | undefined
) {
    if (!providerId) {
        return undefined;
    }

    return snapshot?.entries.find((entry) => entry.provider.id === providerId);
}

function buildEmbeddingModelPickerOption(input: {
    providerId: RuntimeProviderId;
    providerLabel: string;
    model: {
        id: string;
        label: string;
        inputPrice?: number;
        source?: string;
    };
}): ModelPickerOption {
    return {
        id: input.model.id,
        label: input.model.label,
        providerId: input.providerId,
        providerLabel: input.providerLabel,
        ...(input.model.source ? { source: input.model.source } : {}),
        ...(input.model.inputPrice !== undefined ? { price: input.model.inputPrice } : {}),
        supportsTools: false,
        supportsVision: false,
        supportsReasoning: false,
        capabilityBadges: [],
        compatibilityState: 'compatible',
    };
}

interface ProfilePreferencesControllerInput {
    selection: ProfileSelectionState;
    setStatusMessage: (value: string | undefined) => void;
}

type ModelPreferenceDraft = {
    profileId: string;
    providerId?: RuntimeProviderId;
    modelId?: string;
};

interface ModelPreferenceDraftState {
    utilityModelDraft: ModelPreferenceDraft | undefined;
    memoryRetrievalModelDraft: ModelPreferenceDraft | undefined;
}

export function useProfilePreferencesController(input: ProfilePreferencesControllerInput) {
    const utils = trpc.useUtils();
    const [modelPreferenceDrafts, setModelPreferenceDrafts] = useState<ModelPreferenceDraftState>({
        utilityModelDraft: undefined,
        memoryRetrievalModelDraft: undefined,
    });

    const editPreferenceQuery = trpc.conversation.getEditPreference.useQuery(
        {
            profileId: input.selection.selectedProfileIdForSettings,
        },
        {
            enabled: Boolean(input.selection.selectedProfileIdForSettings),
            ...PROGRESSIVE_QUERY_OPTIONS,
        }
    );
    const setEditPreferenceMutation = trpc.conversation.setEditPreference.useMutation({
        onMutate: async (variables) => {
            await utils.conversation.getEditPreference.cancel({
                profileId: variables.profileId,
            });
            const previous = utils.conversation.getEditPreference.getData({
                profileId: variables.profileId,
            });
            utils.conversation.getEditPreference.setData(
                {
                    profileId: variables.profileId,
                },
                {
                    value: variables.value,
                }
            );
            return {
                previous,
                profileId: variables.profileId,
            };
        },
        onError: (_error, _variables, context) => {
            if (context?.previous) {
                utils.conversation.getEditPreference.setData(
                    {
                        profileId: context.profileId,
                    },
                    context.previous
                );
            }
        },
        onSuccess: (result, variables) => {
            utils.conversation.getEditPreference.setData(
                {
                    profileId: variables.profileId,
                },
                result
            );
        },
    });
    const threadTitlePreferenceQuery = trpc.conversation.getThreadTitlePreference.useQuery(
        {
            profileId: input.selection.selectedProfileIdForSettings,
        },
        {
            enabled: Boolean(input.selection.selectedProfileIdForSettings),
            ...PROGRESSIVE_QUERY_OPTIONS,
        }
    );
    const setThreadTitlePreferenceMutation = trpc.conversation.setThreadTitlePreference.useMutation({
        onMutate: async (variables) => {
            await utils.conversation.getThreadTitlePreference.cancel({
                profileId: variables.profileId,
            });
            const previous = utils.conversation.getThreadTitlePreference.getData({
                profileId: variables.profileId,
            });
            utils.conversation.getThreadTitlePreference.setData(
                {
                    profileId: variables.profileId,
                },
                {
                    mode: variables.mode,
                }
            );
            return {
                previous,
                profileId: variables.profileId,
            };
        },
        onError: (_error, _variables, context) => {
            if (context?.previous) {
                utils.conversation.getThreadTitlePreference.setData(
                    {
                        profileId: context.profileId,
                    },
                    context.previous
                );
            }
        },
        onSuccess: (result, variables) => {
            utils.conversation.getThreadTitlePreference.setData(
                {
                    profileId: variables.profileId,
                },
                result
            );
        },
    });
    const executionPresetQuery = trpc.profile.getExecutionPreset.useQuery(
        {
            profileId: input.selection.selectedProfileIdForSettings,
        },
        {
            enabled: Boolean(input.selection.selectedProfileIdForSettings),
            ...PROGRESSIVE_QUERY_OPTIONS,
        }
    );
    const setExecutionPresetMutation = trpc.profile.setExecutionPreset.useMutation({
        onMutate: async (variables) => {
            await utils.profile.getExecutionPreset.cancel({
                profileId: variables.profileId,
            });
            const previous = utils.profile.getExecutionPreset.getData({
                profileId: variables.profileId,
            });
            utils.profile.getExecutionPreset.setData(
                {
                    profileId: variables.profileId,
                },
                {
                    preset: variables.preset,
                }
            );
            return {
                previous,
                profileId: variables.profileId,
            };
        },
        onError: (_error, _variables, context) => {
            if (context?.previous) {
                utils.profile.getExecutionPreset.setData(
                    {
                        profileId: context.profileId,
                    },
                    context.previous
                );
            }
        },
        onSuccess: (result, variables) => {
            utils.profile.getExecutionPreset.setData(
                {
                    profileId: variables.profileId,
                },
                result
            );
            utils.runtime.getShellBootstrap.setData(
                {
                    profileId: variables.profileId,
                },
                (current) =>
                    current
                        ? {
                              ...current,
                              executionPreset: result.preset,
                          }
                        : current
            );
        },
    });
    const utilityModelQuery = trpc.profile.getUtilityModel.useQuery(
        {
            profileId: input.selection.selectedProfileIdForSettings,
        },
        {
            enabled: Boolean(input.selection.selectedProfileIdForSettings),
            ...PROGRESSIVE_QUERY_OPTIONS,
        }
    );
    const setUtilityModelMutation = trpc.profile.setUtilityModel.useMutation({
        onMutate: async (variables) => {
            await utils.profile.getUtilityModel.cancel({
                profileId: variables.profileId,
            });
            const previous = utils.profile.getUtilityModel.getData({
                profileId: variables.profileId,
            });
            utils.profile.getUtilityModel.setData(
                {
                    profileId: variables.profileId,
                },
                {
                    selection:
                        variables.providerId && variables.modelId
                            ? {
                                  providerId: variables.providerId,
                                  modelId: variables.modelId,
                              }
                            : null,
                }
            );
            return {
                previous,
                profileId: variables.profileId,
            };
        },
        onError: (_error, _variables, context) => {
            if (context?.previous) {
                utils.profile.getUtilityModel.setData(
                    {
                        profileId: context.profileId,
                    },
                    context.previous
                );
            }
        },
        onSuccess: (result, variables) => {
            utils.profile.getUtilityModel.setData(
                {
                    profileId: variables.profileId,
                },
                result
            );
            setModelPreferenceDrafts((current) => ({
                ...current,
                utilityModelDraft: undefined,
            }));
        },
    });
    const memoryRetrievalModelQuery = trpc.profile.getMemoryRetrievalModel.useQuery(
        {
            profileId: input.selection.selectedProfileIdForSettings,
        },
        {
            enabled: Boolean(input.selection.selectedProfileIdForSettings),
            ...PROGRESSIVE_QUERY_OPTIONS,
        }
    );
    const setMemoryRetrievalModelMutation = trpc.profile.setMemoryRetrievalModel.useMutation({
        onMutate: async (variables) => {
            await utils.profile.getMemoryRetrievalModel.cancel({
                profileId: variables.profileId,
            });
            const previous = utils.profile.getMemoryRetrievalModel.getData({
                profileId: variables.profileId,
            });
            utils.profile.getMemoryRetrievalModel.setData(
                {
                    profileId: variables.profileId,
                },
                {
                    selection:
                        variables.providerId && variables.modelId
                            ? {
                                  providerId: variables.providerId,
                                  modelId: variables.modelId,
                              }
                            : null,
                }
            );
            return {
                previous,
                profileId: variables.profileId,
            };
        },
        onError: (_error, _variables, context) => {
            if (context?.previous) {
                utils.profile.getMemoryRetrievalModel.setData(
                    {
                        profileId: context.profileId,
                    },
                    context.previous
                );
            }
        },
        onSuccess: (result, variables) => {
            utils.profile.getMemoryRetrievalModel.setData(
                {
                    profileId: variables.profileId,
                },
                result
            );
            setModelPreferenceDrafts((current) => ({
                ...current,
                memoryRetrievalModelDraft: undefined,
            }));
        },
    });
    const providerControlQuery = trpc.provider.getControlPlane.useQuery(
        {
            profileId: input.selection.selectedProfileIdForSettings,
        },
        {
            enabled: Boolean(input.selection.selectedProfileIdForSettings),
            ...PROGRESSIVE_QUERY_OPTIONS,
        }
    );
    const providerEmbeddingControlQuery = trpc.provider.getEmbeddingControlPlane.useQuery(
        {
            profileId: input.selection.selectedProfileIdForSettings,
        },
        {
            enabled: Boolean(input.selection.selectedProfileIdForSettings),
            ...PROGRESSIVE_QUERY_OPTIONS,
        }
    );

    const actions = createProfilePreferencesActions({
        selectedProfile: input.selection.selectedProfile,
        setEditPreferenceMutation: {
            mutateAsync: async (preferenceInput) => {
                await setEditPreferenceMutation.mutateAsync(preferenceInput);
            },
        },
        setThreadTitlePreferenceMutation: {
            mutateAsync: async (preferenceInput) => {
                await setThreadTitlePreferenceMutation.mutateAsync(preferenceInput);
            },
        },
        setStatusMessage: input.setStatusMessage,
    });
    const wrapFailClosedAction = <TArgs extends unknown[]>(action: (...args: TArgs) => Promise<void>) =>
        createFailClosedAsyncAction(action);

    const providerControl = providerControlQuery.data?.providerControl;
    const providerEmbeddingControl = providerEmbeddingControlQuery.data?.providerEmbeddingControl;
    const utilityProviderItems = listProviderControlProviders(providerControl);
    const memoryRetrievalProviderItems = listProviderEmbeddingControlProviders(providerEmbeddingControl);
    const persistedUtilitySelection = utilityModelQuery.data?.selection ?? null;
    const persistedMemoryRetrievalSelection = memoryRetrievalModelQuery.data?.selection ?? null;
    const activeUtilityDraft =
        modelPreferenceDrafts.utilityModelDraft?.profileId === input.selection.selectedProfileIdForSettings
            ? modelPreferenceDrafts.utilityModelDraft
            : undefined;
    const activeMemoryRetrievalDraft =
        modelPreferenceDrafts.memoryRetrievalModelDraft?.profileId === input.selection.selectedProfileIdForSettings
            ? modelPreferenceDrafts.memoryRetrievalModelDraft
            : undefined;
    const selectedUtilityProviderId =
        activeUtilityDraft?.providerId ?? persistedUtilitySelection?.providerId ?? utilityProviderItems[0]?.id;
    const selectedUtilityProviderEntry = findProviderControlEntry(providerControl, selectedUtilityProviderId);
    const selectedUtilityProvider = utilityProviderItems.find((provider) => provider.id === selectedUtilityProviderId);
    const utilityModelOptions =
        selectedUtilityProviderEntry?.models.map((model) =>
            buildModelPickerOption({
                model,
                ...(selectedUtilityProvider ? { provider: selectedUtilityProvider } : {}),
                compatibilityContext: {
                    surface: 'settings',
                },
            })
        ) ?? [];
    const requestedUtilityModelId = activeUtilityDraft?.modelId ?? persistedUtilitySelection?.modelId ?? '';
    const selectedUtilityModelId =
        requestedUtilityModelId && utilityModelOptions.some((option) => option.id === requestedUtilityModelId)
            ? requestedUtilityModelId
            : (utilityModelOptions[0]?.id ?? '');
    const selectedUtilityModelOption = utilityModelOptions.find((option) => option.id === selectedUtilityModelId);
    const selectedMemoryRetrievalProviderId =
        activeMemoryRetrievalDraft?.providerId ??
        persistedMemoryRetrievalSelection?.providerId ??
        memoryRetrievalProviderItems[0]?.id;
    const selectedMemoryRetrievalProviderEntry = findProviderEmbeddingControlEntry(
        providerEmbeddingControl,
        selectedMemoryRetrievalProviderId
    );
    const memoryRetrievalModelOptions =
        selectedMemoryRetrievalProviderEntry?.models.map((model) =>
            buildEmbeddingModelPickerOption({
                providerId: selectedMemoryRetrievalProviderEntry.provider.id,
                providerLabel: selectedMemoryRetrievalProviderEntry.provider.label,
                model,
            })
        ) ?? [];
    const requestedMemoryRetrievalModelId =
        activeMemoryRetrievalDraft?.modelId ?? persistedMemoryRetrievalSelection?.modelId ?? '';
    const selectedMemoryRetrievalModelId =
        requestedMemoryRetrievalModelId &&
        memoryRetrievalModelOptions.some((option) => option.id === requestedMemoryRetrievalModelId)
            ? requestedMemoryRetrievalModelId
            : (memoryRetrievalModelOptions[0]?.id ?? '');
    const selectedMemoryRetrievalModelOption = memoryRetrievalModelOptions.find(
        (option) => option.id === selectedMemoryRetrievalModelId
    );

    return {
        editPreferenceQuery,
        setEditPreferenceMutation,
        threadTitlePreferenceQuery,
        setThreadTitlePreferenceMutation,
        executionPresetQuery,
        setExecutionPresetMutation,
        utilityModelQuery,
        setUtilityModelMutation,
        memoryRetrievalModelQuery,
        setMemoryRetrievalModelMutation,
        providerControlQuery,
        providerEmbeddingControlQuery,
        utilityProviderItems,
        memoryRetrievalProviderItems,
        selectedUtilityProviderId,
        utilityModelOptions,
        selectedUtilityModelId,
        selectedUtilityModelOption,
        utilityModelSelection: persistedUtilitySelection,
        selectedMemoryRetrievalProviderId,
        memoryRetrievalModelOptions,
        selectedMemoryRetrievalModelId,
        selectedMemoryRetrievalModelOption,
        memoryRetrievalModelSelection: persistedMemoryRetrievalSelection,
        executionPreset:
            executionPresetQuery.data?.preset === 'privacy' ||
            executionPresetQuery.data?.preset === 'standard' ||
            executionPresetQuery.data?.preset === 'yolo'
                ? executionPresetQuery.data.preset
                : 'standard',
        editPreference:
            editPreferenceQuery.data?.value === 'ask' ||
            editPreferenceQuery.data?.value === 'truncate' ||
            editPreferenceQuery.data?.value === 'branch'
                ? editPreferenceQuery.data.value
                : 'ask',
        threadTitleMode:
            threadTitlePreferenceQuery.data?.mode === 'template' ||
            threadTitlePreferenceQuery.data?.mode === 'ai_optional'
                ? threadTitlePreferenceQuery.data.mode
                : 'template',
        setUtilityProviderId: (providerId: RuntimeProviderId | undefined) => {
            input.setStatusMessage(undefined);
            const nextProviderEntry = findProviderControlEntry(providerControl, providerId);
            const nextModelId = nextProviderEntry?.models[0]?.id;
            setModelPreferenceDrafts((current) => ({
                ...current,
                utilityModelDraft: input.selection.selectedProfileIdForSettings
                    ? {
                          profileId: input.selection.selectedProfileIdForSettings,
                          ...(providerId ? { providerId } : {}),
                          ...(nextModelId ? { modelId: nextModelId } : {}),
                      }
                    : undefined,
            }));
        },
        setUtilityModelId: (modelId: string) => {
            if (!input.selection.selectedProfileIdForSettings || !selectedUtilityProviderId) {
                return;
            }

            input.setStatusMessage(undefined);
            setModelPreferenceDrafts((current) => ({
                ...current,
                utilityModelDraft: {
                    profileId: input.selection.selectedProfileIdForSettings,
                    providerId: selectedUtilityProviderId,
                    modelId,
                },
            }));
        },
        setMemoryRetrievalProviderId: (providerId: RuntimeProviderId | undefined) => {
            input.setStatusMessage(undefined);
            const nextProviderEntry = findProviderEmbeddingControlEntry(providerEmbeddingControl, providerId);
            const nextModelId = nextProviderEntry?.models[0]?.id;
            setModelPreferenceDrafts((current) => ({
                ...current,
                memoryRetrievalModelDraft: input.selection.selectedProfileIdForSettings
                    ? {
                          profileId: input.selection.selectedProfileIdForSettings,
                          ...(providerId ? { providerId } : {}),
                          ...(nextModelId ? { modelId: nextModelId } : {}),
                      }
                    : undefined,
            }));
        },
        setMemoryRetrievalModelId: (modelId: string) => {
            if (!input.selection.selectedProfileIdForSettings || !selectedMemoryRetrievalProviderId) {
                return;
            }

            input.setStatusMessage(undefined);
            setModelPreferenceDrafts((current) => ({
                ...current,
                memoryRetrievalModelDraft: {
                    profileId: input.selection.selectedProfileIdForSettings,
                    providerId: selectedMemoryRetrievalProviderId,
                    modelId,
                },
            }));
        },
        saveMemoryRetrievalModel: wrapFailClosedAction(async () => {
            if (
                !input.selection.selectedProfile ||
                !selectedMemoryRetrievalProviderId ||
                selectedMemoryRetrievalModelId.length === 0
            ) {
                return;
            }

            await setMemoryRetrievalModelMutation.mutateAsync({
                profileId: input.selection.selectedProfile.id,
                providerId: selectedMemoryRetrievalProviderId,
                modelId: selectedMemoryRetrievalModelId,
            });
            input.setStatusMessage('Updated Memory Retrieval model.');
        }),
        clearMemoryRetrievalModel: wrapFailClosedAction(async () => {
            if (!input.selection.selectedProfile) {
                return;
            }

            setModelPreferenceDrafts((current) => ({
                ...current,
                memoryRetrievalModelDraft: undefined,
            }));
            await setMemoryRetrievalModelMutation.mutateAsync({
                profileId: input.selection.selectedProfile.id,
            });
            input.setStatusMessage(
                'Cleared Memory Retrieval model. Neon will leave semantic retrieval unconfigured.'
            );
        }),
        updateExecutionPreset: wrapFailClosedAction(async (preset: 'privacy' | 'standard' | 'yolo') => {
            if (!input.selection.selectedProfile) {
                return;
            }

            await setExecutionPresetMutation.mutateAsync({
                profileId: input.selection.selectedProfile.id,
                preset,
            });
            input.setStatusMessage('Updated execution preset.');
        }),
        updateEditPreference: wrapFailClosedAction(actions.updateEditPreference),
        updateThreadTitleMode: wrapFailClosedAction(actions.updateThreadTitleMode),
        saveUtilityModel: wrapFailClosedAction(async () => {
            if (!input.selection.selectedProfile || !selectedUtilityProviderId || selectedUtilityModelId.length === 0) {
                return;
            }

            await setUtilityModelMutation.mutateAsync({
                profileId: input.selection.selectedProfile.id,
                providerId: selectedUtilityProviderId,
                modelId: selectedUtilityModelId,
            });
            input.setStatusMessage('Updated Utility AI model.');
        }),
        clearUtilityModel: wrapFailClosedAction(async () => {
            if (!input.selection.selectedProfile) {
                return;
            }

            setModelPreferenceDrafts((current) => ({
                ...current,
                utilityModelDraft: undefined,
            }));
            await setUtilityModelMutation.mutateAsync({
                profileId: input.selection.selectedProfile.id,
            });
            input.setStatusMessage('Cleared Utility AI model. Neon will fall back to the active conversation model.');
        }),
    };
}
