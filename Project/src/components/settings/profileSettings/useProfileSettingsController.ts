import { useEffect, useState } from 'react';

import { createProfileSettingsActions } from '@/web/components/settings/profileSettings/actions';
import { refetchProfilePreference } from '@/web/components/settings/profileSettings/refetch';
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
            refetchProfilePreference(editPreferenceQuery);
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
            refetchProfilePreference(threadTitlePreferenceQuery);
        },
    });

    useEffect(() => {
        setRenameValue(selectedProfile?.name ?? '');
    }, [selectedProfile?.id, selectedProfile?.name]);

    useEffect(() => {
        const aiModel = threadTitlePreferenceQuery.data?.aiModel ?? '';
        setThreadTitleAiModelInput(aiModel);
    }, [threadTitlePreferenceQuery.data?.aiModel, threadTitlePreferenceQuery.data?.mode]);

    const actions = createProfileSettingsActions({
        activeProfileId: input.activeProfileId,
        selectedProfile,
        newProfileName,
        renameValue,
        threadTitleAiModelInput,
        profilesQuery,
        createMutation,
        renameMutation,
        duplicateMutation,
        deleteMutation,
        setActiveMutation,
        setEditPreferenceMutation,
        setThreadTitlePreferenceMutation,
        setNewProfileName,
        setSelectedProfileId,
        setStatusMessage,
        setConfirmDeleteOpen,
        onProfileActivated: input.onProfileActivated,
    });

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
        ...actions,
    };
}
