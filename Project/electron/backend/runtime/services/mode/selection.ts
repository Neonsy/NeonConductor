import type { ModeDefinitionRecord } from '@/app/backend/persistence/types';
import type { TopLevelTab } from '@/app/backend/runtime/contracts';

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

export function pickActiveMode(
    modes: ModeDefinitionRecord[],
    persistedModeKey: string | undefined,
    topLevelTab: TopLevelTab
): ModeDefinitionRecord | undefined {
    const fallbackModeKey = DEFAULT_MODE_BY_TAB[topLevelTab];
    return (
        modes.find((mode) => mode.modeKey === persistedModeKey) ??
        modes.find((mode) => mode.modeKey === fallbackModeKey) ??
        modes.at(0)
    );
}
