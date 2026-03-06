import { modeStore, settingsStore } from '@/app/backend/persistence/stores';
import type { ModeDefinitionRecord } from '@/app/backend/persistence/types';
import type { TopLevelTab } from '@/app/backend/runtime/contracts';
import { errModeResolution, okModeResolution, type ModeResolutionResult } from '@/app/backend/runtime/services/mode/errors';

const MODE_ACTIVE_KEY_PREFIX = 'mode_active';

const DEFAULT_MODE_BY_TAB: Record<TopLevelTab, string> = {
    chat: 'chat',
    agent: 'code',
    orchestrator: 'plan',
};

export function toActiveModeKey(topLevelTab: TopLevelTab, workspaceFingerprint?: string): string {
    if (!workspaceFingerprint) {
        return `${MODE_ACTIVE_KEY_PREFIX}:${topLevelTab}`;
    }

    return `${MODE_ACTIVE_KEY_PREFIX}:${topLevelTab}:workspace:${workspaceFingerprint}`;
}

export interface ResolvedActiveMode {
    modes: ModeDefinitionRecord[];
    activeMode: ModeDefinitionRecord;
    activeKey: string;
}

function pickActiveMode(modes: ModeDefinitionRecord[], persistedModeKey: string | undefined, topLevelTab: TopLevelTab) {
    const fallbackModeKey = DEFAULT_MODE_BY_TAB[topLevelTab];
    return (
        modes.find((mode) => mode.modeKey === persistedModeKey) ??
        modes.find((mode) => mode.modeKey === fallbackModeKey) ??
        modes.at(0)
    );
}

export async function resolveActiveMode(input: {
    profileId: string;
    topLevelTab: TopLevelTab;
    workspaceFingerprint?: string;
}): Promise<ModeResolutionResult<ResolvedActiveMode>> {
    const modes = (await modeStore.listByProfileAndTab(input.profileId, input.topLevelTab)).filter((mode) => mode.enabled);
    const firstMode = modes.at(0);
    if (!firstMode) {
        return errModeResolution(
            `No enabled modes found for tab "${input.topLevelTab}" on profile "${input.profileId}".`
        );
    }

    const activeKey = toActiveModeKey(input.topLevelTab, input.workspaceFingerprint);
    const persistedModeKey = await settingsStore.getStringOptional(input.profileId, activeKey);
    const activeMode = pickActiveMode(modes, persistedModeKey, input.topLevelTab) ?? firstMode;

    return okModeResolution({
        modes,
        activeMode,
        activeKey,
    });
}
