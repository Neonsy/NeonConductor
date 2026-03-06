import {
    getActivateProfileStatusMessage,
    getDeleteProfileStatusMessage,
    getDuplicateProfileStatusMessage,
    getRenameProfileStatusMessage,
} from '@/web/components/settings/profileSettings/messages';
import { refetchProfileList } from '@/web/components/settings/profileSettings/refetch';

export function createProfileSettingsActions(input: {
    activeProfileId: string;
    selectedProfile:
        | {
              id: string;
              name: string;
          }
        | undefined;
    newProfileName: string;
    renameValue: string;
    threadTitleAiModelInput: string;
    profilesQuery: { refetch: () => Promise<unknown> };
    createMutation: { mutateAsync: (input: { name?: string }) => Promise<{ profile: { id: string; name: string } }> };
    renameMutation: {
        mutateAsync: (input: { profileId: string; name: string }) => Promise<
            { updated: false; reason: 'profile_not_found' } | { updated: true; profile: { name: string } }
        >;
    };
    duplicateMutation: {
        mutateAsync: (input: { profileId: string }) => Promise<
            { duplicated: false; reason: 'profile_not_found' } | { duplicated: true; profile: { id: string; name: string } }
        >;
    };
    deleteMutation: {
        mutateAsync: (input: { profileId: string }) => Promise<{
            deleted: boolean;
            reason?: 'last_profile' | 'profile_not_found';
            activeProfileId?: string;
        }>;
    };
    setActiveMutation: {
        mutateAsync: (input: { profileId: string }) => Promise<
            { updated: false; reason: 'profile_not_found' } | { updated: true; profile: { id: string; name: string } }
        >;
    };
    setEditPreferenceMutation: {
        mutateAsync: (input: { profileId: string; value: 'ask' | 'truncate' | 'branch' }) => Promise<unknown>;
    };
    setThreadTitlePreferenceMutation: {
        mutateAsync: (input: {
            profileId: string;
            mode: 'template' | 'ai_optional';
            aiModel?: string;
        }) => Promise<unknown>;
    };
    setNewProfileName: (value: string) => void;
    setSelectedProfileId: (value: string | undefined) => void;
    setStatusMessage: (value: string | undefined) => void;
    setConfirmDeleteOpen: (value: boolean) => void;
    onProfileActivated: (profileId: string) => void;
}) {
    return {
        createProfile: async () => {
            const result = await input.createMutation.mutateAsync({
                ...(input.newProfileName.trim() ? { name: input.newProfileName.trim() } : {}),
            });
            input.setStatusMessage(`Created profile "${result.profile.name}".`);
            input.setNewProfileName('');
            input.setSelectedProfileId(result.profile.id);
            await refetchProfileList(input.profilesQuery);
        },
        renameProfile: async () => {
            if (!input.selectedProfile) {
                return;
            }

            const result = await input.renameMutation.mutateAsync({
                profileId: input.selectedProfile.id,
                name: input.renameValue.trim(),
            });
            input.setStatusMessage(
                getRenameProfileStatusMessage({
                    updated: result.updated,
                    profileName: result.updated ? result.profile.name : undefined,
                })
            );
            if (!result.updated) {
                return;
            }

            await refetchProfileList(input.profilesQuery);
        },
        duplicateProfile: async () => {
            if (!input.selectedProfile) {
                return;
            }

            const result = await input.duplicateMutation.mutateAsync({
                profileId: input.selectedProfile.id,
            });
            input.setStatusMessage(
                getDuplicateProfileStatusMessage({
                    duplicated: result.duplicated,
                    profileName: result.duplicated ? result.profile.name : undefined,
                })
            );
            if (!result.duplicated) {
                return;
            }

            input.setSelectedProfileId(result.profile.id);
            await refetchProfileList(input.profilesQuery);
        },
        activateProfile: async () => {
            if (!input.selectedProfile || input.selectedProfile.id === input.activeProfileId) {
                return;
            }

            const result = await input.setActiveMutation.mutateAsync({
                profileId: input.selectedProfile.id,
            });
            input.setStatusMessage(
                getActivateProfileStatusMessage({
                    updated: result.updated,
                    profileName: result.updated ? result.profile.name : undefined,
                })
            );
            if (!result.updated) {
                return;
            }

            input.onProfileActivated(result.profile.id);
            await refetchProfileList(input.profilesQuery);
        },
        updateEditPreference: async (value: 'ask' | 'truncate' | 'branch') => {
            if (!input.selectedProfile) {
                return;
            }

            await input.setEditPreferenceMutation.mutateAsync({
                profileId: input.selectedProfile.id,
                value,
            });
            input.setStatusMessage('Updated conversation edit behavior.');
        },
        updateThreadTitleMode: async (mode: 'template' | 'ai_optional') => {
            if (!input.selectedProfile) {
                return;
            }

            if (mode === 'ai_optional' && input.threadTitleAiModelInput.trim().length === 0) {
                input.setStatusMessage(
                    'Set a title AI model (for example "openai/gpt-5-mini") before enabling AI optional mode.'
                );
                return;
            }

            await input.setThreadTitlePreferenceMutation.mutateAsync({
                profileId: input.selectedProfile.id,
                mode,
                ...(mode === 'ai_optional' ? { aiModel: input.threadTitleAiModelInput.trim() } : {}),
            });
            input.setStatusMessage('Updated thread title generation settings.');
        },
        saveThreadTitleAiModel: async () => {
            if (!input.selectedProfile || input.threadTitleAiModelInput.trim().length === 0) {
                return;
            }

            await input.setThreadTitlePreferenceMutation.mutateAsync({
                profileId: input.selectedProfile.id,
                mode: 'ai_optional',
                aiModel: input.threadTitleAiModelInput.trim(),
            });
            input.setStatusMessage('Updated title AI model.');
        },
        deleteProfile: async () => {
            if (!input.selectedProfile) {
                input.setConfirmDeleteOpen(false);
                return;
            }

            const result = await input.deleteMutation.mutateAsync({
                profileId: input.selectedProfile.id,
            });
            input.setConfirmDeleteOpen(false);
            input.setStatusMessage(
                getDeleteProfileStatusMessage({
                    deleted: result.deleted,
                    reason: result.reason,
                })
            );
            if (!result.deleted) {
                return;
            }

            if (result.activeProfileId) {
                input.onProfileActivated(result.activeProfileId);
            }
            input.setSelectedProfileId(undefined);
            await refetchProfileList(input.profilesQuery);
        },
    };
}
