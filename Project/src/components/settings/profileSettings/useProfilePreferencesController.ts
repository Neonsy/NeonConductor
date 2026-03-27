import { useState } from 'react';

import { createProfileSettingsActions } from '@/web/components/settings/profileSettings/actions';
import type { ProfileSelectionState } from '@/web/components/settings/profileSettings/useProfileSelectionState';
import { createFailClosedAsyncAction } from '@/web/lib/async/createFailClosedAsyncAction';
import { PROGRESSIVE_QUERY_OPTIONS } from '@/web/lib/query/progressiveQueryOptions';
import { trpc } from '@/web/trpc/client';

interface ProfilePreferencesControllerInput {
    selection: ProfileSelectionState;
    setStatusMessage: (value: string | undefined) => void;
}

export function useProfilePreferencesController(input: ProfilePreferencesControllerInput) {
    const utils = trpc.useUtils();
    const [threadTitleAiModelDraft, setThreadTitleAiModelDraft] = useState<
        { profileId: string; value: string } | undefined
    >(undefined);

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
                    ...(variables.aiModel ? { aiModel: variables.aiModel } : {}),
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

    const threadTitleAiModelInput =
        threadTitleAiModelDraft?.profileId === input.selection.selectedProfileIdForSettings
            ? threadTitleAiModelDraft.value
            : (threadTitlePreferenceQuery.data?.aiModel ?? '');

    const actions = createProfileSettingsActions({
        activeProfileId: '',
        selectedProfile: input.selection.selectedProfile,
        newProfileName: '',
        renameValue: '',
        threadTitleAiModelInput,
        updateProfileList: () => [],
        setActiveProfileCache: () => undefined,
        createMutation: {
            mutateAsync: async () => {
                throw new Error('create mutation is not available in profile preferences');
            },
        },
        renameMutation: {
            mutateAsync: async () => {
                throw new Error('rename mutation is not available in profile preferences');
            },
        },
        duplicateMutation: {
            mutateAsync: async () => {
                throw new Error('duplicate mutation is not available in profile preferences');
            },
        },
        deleteMutation: {
            mutateAsync: async () => {
                throw new Error('delete mutation is not available in profile preferences');
            },
        },
        setActiveMutation: {
            mutateAsync: async () => {
                throw new Error('set active mutation is not available in profile preferences');
            },
        },
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
        setNewProfileName: () => undefined,
        setRenameDraft: () => undefined,
        setSelectedProfileId: () => undefined,
        setStatusMessage: input.setStatusMessage,
        setConfirmDeleteOpen: () => undefined,
        onProfileActivated: () => undefined,
    });
    const wrapFailClosedAction = <TArgs extends unknown[]>(action: (...args: TArgs) => Promise<void>) =>
        createFailClosedAsyncAction(action);

    return {
        editPreferenceQuery,
        setEditPreferenceMutation,
        threadTitlePreferenceQuery,
        setThreadTitlePreferenceMutation,
        executionPresetQuery,
        setExecutionPresetMutation,
        threadTitleAiModelInput,
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
        setThreadTitleAiModelInput: (value: string) => {
            setThreadTitleAiModelDraft(
                input.selection.selectedProfileIdForSettings
                    ? {
                          profileId: input.selection.selectedProfileIdForSettings,
                          value,
                      }
                    : undefined
            );
        },
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
        saveThreadTitleAiModel: wrapFailClosedAction(actions.saveThreadTitleAiModel),
    };
}
