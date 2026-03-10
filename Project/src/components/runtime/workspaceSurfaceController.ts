import { useState } from 'react';

import { useWorkspaceModeState } from '@/web/components/runtime/useWorkspaceModeState';
import { useWorkspaceProfileState } from '@/web/components/runtime/useWorkspaceProfileState';

import type { TopLevelTab } from '@/app/backend/runtime/contracts';

export function useWorkspaceSurfaceController() {
    const [topLevelTab, setTopLevelTab] = useState<TopLevelTab>('chat');
    const [showSettings, setShowSettings] = useState(false);
    const [currentWorkspaceFingerprint, setCurrentWorkspaceFingerprint] = useState<string | undefined>(undefined);

    const profileState = useWorkspaceProfileState({
        setTopLevelTab,
    });
    const modeState = useWorkspaceModeState({
        resolvedProfileId: profileState.resolvedProfileId,
        topLevelTab,
        ...(currentWorkspaceFingerprint ? { workspaceFingerprint: currentWorkspaceFingerprint } : {}),
    });

    return {
        profiles: profileState.profiles,
        resolvedProfileId: profileState.resolvedProfileId,
        topLevelTab,
        setTopLevelTab,
        showSettings,
        setShowSettings,
        currentWorkspaceFingerprint,
        setCurrentWorkspaceFingerprint,
        modes: modeState.modes,
        activeModeKey: modeState.activeModeKey,
        hasResolvedInitialMode: modeState.hasResolvedInitialMode,
        profileSetActiveMutation: profileState.profileSetActiveMutation,
        setActiveModeMutation: modeState.setActiveModeMutation,
        setResolvedProfile: profileState.setResolvedProfile,
        selectProfile: profileState.selectProfile,
        selectMode: modeState.selectMode,
    };
}
