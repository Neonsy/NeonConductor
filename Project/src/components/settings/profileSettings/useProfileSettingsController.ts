import { useEffect, useState } from 'react';

import { resolveSelectedProfileId } from '@/web/components/settings/profileSettings/selection';
import { trpc } from '@/web/trpc/client';

export function useProfileSettingsController(input: {
    activeProfileId: string;
    onProfileActivated: (profileId: string) => void;
}) {
    const [selectedProfileId, setSelectedProfileId] = useState<string | undefined>(undefined);
    const [newProfileName, setNewProfileName] = useState('');
    const [renameValue, setRenameValue] = useState('');
    const [threadTitleAiModelInput, setThreadTitleAiModelInput] = useState('');
    const [statusMessage, setStatusMessage] = useState<string | undefined>(undefined);
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

    const profilesQuery = trpc.profile.list.useQuery(undefined, { refetchOnWindowFocus: false });
    const createMutation = trpc.profile.create.useMutation();
    const renameMutation = trpc.profile.rename.useMutation();
    const duplicateMutation = trpc.profile.duplicate.useMutation();
    const deleteMutation = trpc.profile.delete.useMutation();
    const setActiveMutation = trpc.profile.setActive.useMutation();

    const profiles = profilesQuery.data?.profiles ?? [];

    useEffect(() => {
        const nextSelectedProfileId = resolveSelectedProfileId(profiles, selectedProfileId, input.activeProfileId);
        if (nextSelectedProfileId !== selectedProfileId) {
            setSelectedProfileId(nextSelectedProfileId);
        }
    }, [input.activeProfileId, profiles, selectedProfileId]);

    const selectedProfile = selectedProfileId ? profiles.find((profile) => profile.id === selectedProfileId) : undefined;
    const selectedProfileIdForSettings = selectedProfileId ?? input.activeProfileId;

    const editPreferenceQuery = trpc.conversation.getEditPreference.useQuery(
        {
            profileId: selectedProfileIdForSettings,
        },
        {
            enabled: Boolean(selectedProfileIdForSettings),
            refetchOnWindowFocus: false,
        }
    );
    const setEditPreferenceMutation = trpc.conversation.setEditPreference.useMutation({
        onSuccess: () => {
            void editPreferenceQuery.refetch();
        },
    });
    const threadTitlePreferenceQuery = trpc.conversation.getThreadTitlePreference.useQuery(
        {
            profileId: selectedProfileIdForSettings,
        },
        {
            enabled: Boolean(selectedProfileIdForSettings),
            refetchOnWindowFocus: false,
        }
    );
    const setThreadTitlePreferenceMutation = trpc.conversation.setThreadTitlePreference.useMutation({
        onSuccess: () => {
            void threadTitlePreferenceQuery.refetch();
        },
    });

    useEffect(() => {
        setRenameValue(selectedProfile?.name ?? '');
    }, [selectedProfile?.id, selectedProfile?.name]);

    useEffect(() => {
        const aiModel = threadTitlePreferenceQuery.data?.aiModel ?? '';
        setThreadTitleAiModelInput(aiModel);
    }, [threadTitlePreferenceQuery.data?.aiModel, threadTitlePreferenceQuery.data?.mode]);

    async function refetchProfiles(): Promise<void> {
        await profilesQuery.refetch();
    }

    return {
        profiles,
        selectedProfile,
        selectedProfileId,
        newProfileName,
        renameValue,
        threadTitleAiModelInput,
        statusMessage,
        confirmDeleteOpen,
        cannotDeleteLastProfile: profiles.length <= 1,
        profilesQuery,
        createMutation,
        renameMutation,
        duplicateMutation,
        deleteMutation,
        setActiveMutation,
        editPreferenceQuery,
        setEditPreferenceMutation,
        threadTitlePreferenceQuery,
        setThreadTitlePreferenceMutation,
        setSelectedProfileId: (profileId: string | undefined) => {
            setSelectedProfileId(profileId);
            setStatusMessage(undefined);
        },
        setNewProfileName,
        setRenameValue,
        setThreadTitleAiModelInput,
        setStatusMessage,
        setConfirmDeleteOpen,
        createProfile: async () => {
            const result = await createMutation.mutateAsync({
                ...(newProfileName.trim() ? { name: newProfileName.trim() } : {}),
            });
            setStatusMessage(`Created profile "${result.profile.name}".`);
            setNewProfileName('');
            setSelectedProfileId(result.profile.id);
            await refetchProfiles();
        },
        renameProfile: async () => {
            if (!selectedProfile) {
                return;
            }

            const result = await renameMutation.mutateAsync({
                profileId: selectedProfile.id,
                name: renameValue.trim(),
            });
            if (!result.updated) {
                setStatusMessage('Rename failed: profile not found.');
                return;
            }

            setStatusMessage(`Renamed profile to "${result.profile.name}".`);
            await refetchProfiles();
        },
        duplicateProfile: async () => {
            if (!selectedProfile) {
                return;
            }

            const result = await duplicateMutation.mutateAsync({
                profileId: selectedProfile.id,
            });
            if (!result.duplicated) {
                setStatusMessage('Duplicate failed: profile not found.');
                return;
            }

            setStatusMessage(`Duplicated as "${result.profile.name}".`);
            setSelectedProfileId(result.profile.id);
            await refetchProfiles();
        },
        activateProfile: async () => {
            if (!selectedProfile) {
                return;
            }

            const result = await setActiveMutation.mutateAsync({
                profileId: selectedProfile.id,
            });
            if (!result.updated) {
                setStatusMessage('Set active failed: profile not found.');
                return;
            }

            setStatusMessage(`Active profile set to "${result.profile.name}".`);
            input.onProfileActivated(result.profile.id);
            await refetchProfiles();
        },
        updateEditPreference: async (value: 'ask' | 'truncate' | 'branch') => {
            if (!selectedProfile) {
                return;
            }

            await setEditPreferenceMutation.mutateAsync({
                profileId: selectedProfile.id,
                value,
            });
            setStatusMessage('Updated conversation edit behavior.');
        },
        updateThreadTitleMode: async (mode: 'template' | 'ai_optional') => {
            if (!selectedProfile) {
                return;
            }

            if (mode === 'ai_optional' && threadTitleAiModelInput.trim().length === 0) {
                setStatusMessage(
                    'Set a title AI model (for example "openai/gpt-5-mini") before enabling AI optional mode.'
                );
                return;
            }

            await setThreadTitlePreferenceMutation.mutateAsync({
                profileId: selectedProfile.id,
                mode,
                ...(mode === 'ai_optional' ? { aiModel: threadTitleAiModelInput.trim() } : {}),
            });
            setStatusMessage('Updated thread title generation settings.');
        },
        saveThreadTitleAiModel: async () => {
            if (!selectedProfile || threadTitleAiModelInput.trim().length === 0) {
                return;
            }

            await setThreadTitlePreferenceMutation.mutateAsync({
                profileId: selectedProfile.id,
                mode: 'ai_optional',
                aiModel: threadTitleAiModelInput.trim(),
            });
            setStatusMessage('Updated title AI model.');
        },
        deleteProfile: async () => {
            if (!selectedProfile) {
                setConfirmDeleteOpen(false);
                return;
            }

            const result = await deleteMutation.mutateAsync({
                profileId: selectedProfile.id,
            });
            setConfirmDeleteOpen(false);
            if (!result.deleted) {
                setStatusMessage(
                    result.reason === 'last_profile'
                        ? 'Cannot delete the last remaining profile.'
                        : 'Delete failed: profile not found.'
                );
                return;
            }

            setStatusMessage('Profile deleted.');
            if (result.activeProfileId) {
                input.onProfileActivated(result.activeProfileId);
            }
            setSelectedProfileId(undefined);
            await refetchProfiles();
        },
    };
}
