import { useState } from 'react';

import { useWorkspaceModeState } from '@/web/components/runtime/useWorkspaceModeState';
import { useWorkspaceProfileState } from '@/web/components/runtime/useWorkspaceProfileState';

import type { TopLevelTab } from '@/app/backend/runtime/contracts';

export function useWorkspaceSurfaceController() {
    const [topLevelTab, setTopLevelTab] = useState<TopLevelTab>('chat');
    const [showSettings, setShowSettings] = useState(false);

    const profileState = useWorkspaceProfileState({
        setTopLevelTab,
    });
    const modeState = useWorkspaceModeState({
        resolvedProfileId: profileState.resolvedProfileId,
        topLevelTab,
    });

    return {
        profiles: profileState.profiles,
        resolvedProfileId: profileState.resolvedProfileId,
        topLevelTab,
        setTopLevelTab,
        showSettings,
        setShowSettings,
        modes: modeState.modes,
        activeModeKey: modeState.activeModeKey,
        profileSetActiveMutation: profileState.profileSetActiveMutation,
        setActiveModeMutation: modeState.setActiveModeMutation,
        setResolvedProfile: profileState.setResolvedProfile,
        selectProfile: profileState.selectProfile,
        selectMode: modeState.selectMode,
    };
}
