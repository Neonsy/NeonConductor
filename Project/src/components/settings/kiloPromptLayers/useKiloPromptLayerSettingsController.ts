import { useState } from 'react';

import { PROGRESSIVE_QUERY_OPTIONS } from '@/web/lib/query/progressiveQueryOptions';
import { trpc } from '@/web/trpc/client';

import type { BuiltInModePromptSettingsItem, TopLevelTab } from '@/shared/contracts';

type TopLevelDraftState = Partial<Record<TopLevelTab, { profileId: string; value: string }>>;
type BuiltInModeDraftState = Partial<
    Record<string, { profileId: string; roleDefinition: string; customInstructions: string }>
>;

function resolveTopLevelDraftValue(input: {
    profileId: string;
    topLevelTab: TopLevelTab;
    persistedValue: string | undefined;
    drafts: TopLevelDraftState;
}): string {
    const draft = input.drafts[input.topLevelTab];
    if (draft?.profileId === input.profileId) {
        return draft.value;
    }

    return input.persistedValue ?? '';
}

export function useKiloPromptLayerSettingsController(profileId: string) {
    const utils = trpc.useUtils();
    const [feedbackMessage, setFeedbackMessage] = useState<string | undefined>(undefined);
    const [feedbackTone, setFeedbackTone] = useState<'success' | 'error' | 'info'>('info');
    const [appGlobalDraft, setAppGlobalDraft] = useState<string | undefined>(undefined);
    const [profileGlobalDraft, setProfileGlobalDraft] = useState<{ profileId: string; value: string } | undefined>(
        undefined
    );
    const [topLevelDrafts, setTopLevelDrafts] = useState<TopLevelDraftState>({});
    const [builtInModeDrafts, setBuiltInModeDrafts] = useState<BuiltInModeDraftState>({});

    const settingsQuery = trpc.prompt.getSettings.useQuery({ profileId }, PROGRESSIVE_QUERY_OPTIONS);

    function applySettings(settings: {
        appGlobalInstructions: string;
        profileGlobalInstructions: string;
        topLevelInstructions: Record<TopLevelTab, string>;
        builtInModes: Record<TopLevelTab, BuiltInModePromptSettingsItem[]>;
    }) {
        utils.prompt.getSettings.setData({ profileId }, { settings });
    }

    function getBuiltInModeDraftKey(topLevelTab: TopLevelTab, modeKey: string): string {
        return `${topLevelTab}:${modeKey}`;
    }

    function resolveBuiltInModePrompt(input: {
        topLevelTab: TopLevelTab;
        modeKey: string;
        persistedPrompt: {
            roleDefinition?: string;
            customInstructions?: string;
        };
    }): { roleDefinition: string; customInstructions: string } {
        const draft = builtInModeDrafts[getBuiltInModeDraftKey(input.topLevelTab, input.modeKey)];
        if (draft?.profileId === profileId) {
            return {
                roleDefinition: draft.roleDefinition,
                customInstructions: draft.customInstructions,
            };
        }

        return {
            roleDefinition: input.persistedPrompt.roleDefinition ?? '',
            customInstructions: input.persistedPrompt.customInstructions ?? '',
        };
    }

    const setAppGlobalInstructionsMutation = trpc.prompt.setAppGlobalInstructions.useMutation({
        onSuccess: ({ settings }) => {
            applySettings(settings);
            setAppGlobalDraft(undefined);
            setFeedbackTone('success');
            setFeedbackMessage('Saved app-wide instructions.');
        },
        onError: (error) => {
            setFeedbackTone('error');
            setFeedbackMessage(error.message);
        },
    });

    const resetAppGlobalInstructionsMutation = trpc.prompt.resetAppGlobalInstructions.useMutation({
        onSuccess: ({ settings }) => {
            applySettings(settings);
            setAppGlobalDraft(undefined);
            setFeedbackTone('success');
            setFeedbackMessage('Reset app-wide instructions.');
        },
        onError: (error) => {
            setFeedbackTone('error');
            setFeedbackMessage(error.message);
        },
    });

    const setProfileGlobalInstructionsMutation = trpc.prompt.setProfileGlobalInstructions.useMutation({
        onSuccess: ({ settings }) => {
            applySettings(settings);
            setProfileGlobalDraft(undefined);
            setFeedbackTone('success');
            setFeedbackMessage('Saved profile-wide instructions.');
        },
        onError: (error) => {
            setFeedbackTone('error');
            setFeedbackMessage(error.message);
        },
    });

    const resetProfileGlobalInstructionsMutation = trpc.prompt.resetProfileGlobalInstructions.useMutation({
        onSuccess: ({ settings }) => {
            applySettings(settings);
            setProfileGlobalDraft(undefined);
            setFeedbackTone('success');
            setFeedbackMessage('Reset profile-wide instructions.');
        },
        onError: (error) => {
            setFeedbackTone('error');
            setFeedbackMessage(error.message);
        },
    });

    const setTopLevelInstructionsMutation = trpc.prompt.setTopLevelInstructions.useMutation({
        onSuccess: ({ settings }, variables) => {
            applySettings(settings);
            setTopLevelDrafts((currentDrafts) => ({
                ...currentDrafts,
                [variables.topLevelTab]: undefined,
            }));
            setFeedbackTone('success');
            setFeedbackMessage(`Saved ${variables.topLevelTab} instructions.`);
        },
        onError: (error) => {
            setFeedbackTone('error');
            setFeedbackMessage(error.message);
        },
    });

    const resetTopLevelInstructionsMutation = trpc.prompt.resetTopLevelInstructions.useMutation({
        onSuccess: ({ settings }, variables) => {
            applySettings(settings);
            setTopLevelDrafts((currentDrafts) => ({
                ...currentDrafts,
                [variables.topLevelTab]: undefined,
            }));
            setFeedbackTone('success');
            setFeedbackMessage(`Reset ${variables.topLevelTab} instructions.`);
        },
        onError: (error) => {
            setFeedbackTone('error');
            setFeedbackMessage(error.message);
        },
    });

    const setBuiltInModePromptMutation = trpc.prompt.setBuiltInModePrompt.useMutation({
        onSuccess: ({ settings }, variables) => {
            applySettings(settings);
            setBuiltInModeDrafts((currentDrafts) => ({
                ...currentDrafts,
                [getBuiltInModeDraftKey(variables.topLevelTab, variables.modeKey)]: undefined,
            }));
            setFeedbackTone('success');
            setFeedbackMessage(`Saved built-in ${variables.topLevelTab}:${variables.modeKey} mode prompt.`);
        },
        onError: (error) => {
            setFeedbackTone('error');
            setFeedbackMessage(error.message);
        },
    });

    const resetBuiltInModePromptMutation = trpc.prompt.resetBuiltInModePrompt.useMutation({
        onSuccess: ({ settings }, variables) => {
            applySettings(settings);
            setBuiltInModeDrafts((currentDrafts) => ({
                ...currentDrafts,
                [getBuiltInModeDraftKey(variables.topLevelTab, variables.modeKey)]: undefined,
            }));
            setFeedbackTone('success');
            setFeedbackMessage(`Reset built-in ${variables.topLevelTab}:${variables.modeKey} mode prompt.`);
        },
        onError: (error) => {
            setFeedbackTone('error');
            setFeedbackMessage(error.message);
        },
    });

    const persistedSettings = settingsQuery.data?.settings;
    const appGlobalInstructions = appGlobalDraft ?? persistedSettings?.appGlobalInstructions ?? '';
    const profileGlobalInstructions =
        profileGlobalDraft?.profileId === profileId
            ? profileGlobalDraft.value
            : persistedSettings?.profileGlobalInstructions ?? '';

    function clearFeedback(): void {
        setFeedbackMessage(undefined);
        setFeedbackTone('info');
    }

    return {
        feedback: {
            message: feedbackMessage,
            tone: feedbackTone,
            clear: clearFeedback,
        },
        query: settingsQuery,
        appGlobal: {
            value: appGlobalInstructions,
            isSaving:
                setAppGlobalInstructionsMutation.isPending || resetAppGlobalInstructionsMutation.isPending,
            setValue: (value: string) => {
                setAppGlobalDraft(value);
                clearFeedback();
            },
            save: async () => {
                await setAppGlobalInstructionsMutation.mutateAsync({
                    profileId,
                    value: appGlobalInstructions,
                });
            },
            reset: async () => {
                await resetAppGlobalInstructionsMutation.mutateAsync({ profileId });
            },
        },
        profileGlobal: {
            value: profileGlobalInstructions,
            isSaving:
                setProfileGlobalInstructionsMutation.isPending ||
                resetProfileGlobalInstructionsMutation.isPending,
            setValue: (value: string) => {
                setProfileGlobalDraft({ profileId, value });
                clearFeedback();
            },
            save: async () => {
                await setProfileGlobalInstructionsMutation.mutateAsync({
                    profileId,
                    value: profileGlobalInstructions,
                });
            },
            reset: async () => {
                await resetProfileGlobalInstructionsMutation.mutateAsync({ profileId });
            },
        },
        topLevel: {
            isSaving:
                setTopLevelInstructionsMutation.isPending || resetTopLevelInstructionsMutation.isPending,
            getValue: (topLevelTab: TopLevelTab) =>
                resolveTopLevelDraftValue({
                    profileId,
                    topLevelTab,
                    persistedValue: persistedSettings?.topLevelInstructions[topLevelTab],
                    drafts: topLevelDrafts,
                }),
            setValue: (topLevelTab: TopLevelTab, value: string) => {
                setTopLevelDrafts((currentDrafts) => ({
                    ...currentDrafts,
                    [topLevelTab]: { profileId, value },
                }));
                clearFeedback();
            },
            save: async (topLevelTab: TopLevelTab) => {
                await setTopLevelInstructionsMutation.mutateAsync({
                    profileId,
                    topLevelTab,
                    value: resolveTopLevelDraftValue({
                        profileId,
                        topLevelTab,
                        persistedValue: persistedSettings?.topLevelInstructions[topLevelTab],
                        drafts: topLevelDrafts,
                    }),
                });
            },
            reset: async (topLevelTab: TopLevelTab) => {
                await resetTopLevelInstructionsMutation.mutateAsync({
                    profileId,
                    topLevelTab,
                });
            },
        },
        builtInModes: {
            isSaving:
                setBuiltInModePromptMutation.isPending || resetBuiltInModePromptMutation.isPending,
            getItems: (topLevelTab: TopLevelTab) =>
                (persistedSettings?.builtInModes[topLevelTab] ?? []).map((mode) => ({
                    ...mode,
                    prompt: resolveBuiltInModePrompt({
                        topLevelTab,
                        modeKey: mode.modeKey,
                        persistedPrompt: mode.prompt,
                    }),
                })),
            setPromptField: (
                topLevelTab: TopLevelTab,
                modeKey: string,
                field: 'roleDefinition' | 'customInstructions',
                value: string
            ) => {
                const draftKey = getBuiltInModeDraftKey(topLevelTab, modeKey);
                const persistedMode = (persistedSettings?.builtInModes[topLevelTab] ?? []).find(
                    (candidate) => candidate.modeKey === modeKey
                );
                const currentPrompt = resolveBuiltInModePrompt({
                    topLevelTab,
                    modeKey,
                    persistedPrompt: persistedMode?.prompt ?? {},
                });
                setBuiltInModeDrafts((currentDrafts) => ({
                    ...currentDrafts,
                    [draftKey]: {
                        profileId,
                        roleDefinition:
                            field === 'roleDefinition' ? value : currentPrompt.roleDefinition,
                        customInstructions:
                            field === 'customInstructions' ? value : currentPrompt.customInstructions,
                    },
                }));
                clearFeedback();
            },
            save: async (topLevelTab: TopLevelTab, modeKey: string) => {
                const persistedMode = (persistedSettings?.builtInModes[topLevelTab] ?? []).find(
                    (candidate) => candidate.modeKey === modeKey
                );
                const prompt = resolveBuiltInModePrompt({
                    topLevelTab,
                    modeKey,
                    persistedPrompt: persistedMode?.prompt ?? {},
                });
                await setBuiltInModePromptMutation.mutateAsync({
                    profileId,
                    topLevelTab,
                    modeKey,
                    roleDefinition: prompt.roleDefinition,
                    customInstructions: prompt.customInstructions,
                });
            },
            reset: async (topLevelTab: TopLevelTab, modeKey: string) => {
                await resetBuiltInModePromptMutation.mutateAsync({
                    profileId,
                    topLevelTab,
                    modeKey,
                });
            },
        },
    };
}
