import { modeStore, settingsStore } from '@/app/backend/persistence/stores';
import {
    modeGetActiveInputSchema,
    modeListInputSchema,
    modeSetActiveInputSchema,
} from '@/app/backend/runtime/contracts';
import type { TopLevelTab } from '@/app/backend/runtime/contracts';
import { runtimeEventLogService } from '@/app/backend/runtime/services/runtimeEventLog';
import { publicProcedure, router } from '@/app/backend/trpc/init';

const MODE_ACTIVE_KEY_PREFIX = 'mode_active';

const DEFAULT_MODE_BY_TAB: Record<TopLevelTab, string> = {
    chat: 'chat',
    agent: 'code',
    orchestrator: 'plan',
};

function toActiveModeKey(topLevelTab: TopLevelTab, workspaceFingerprint?: string): string {
    if (!workspaceFingerprint) {
        return `${MODE_ACTIVE_KEY_PREFIX}:${topLevelTab}`;
    }

    return `${MODE_ACTIVE_KEY_PREFIX}:${topLevelTab}:workspace:${workspaceFingerprint}`;
}

async function resolveActiveMode(input: {
    profileId: string;
    topLevelTab: TopLevelTab;
    workspaceFingerprint?: string;
}) {
    const modes = (await modeStore.listByProfileAndTab(input.profileId, input.topLevelTab)).filter(
        (mode) => mode.enabled
    );
    if (modes.length === 0) {
        throw new Error(`No enabled modes found for tab "${input.topLevelTab}" on profile "${input.profileId}".`);
    }

    const activeKey = toActiveModeKey(input.topLevelTab, input.workspaceFingerprint);
    const persistedModeKey = await settingsStore.getStringOptional(input.profileId, activeKey);
    const fallbackModeKey = DEFAULT_MODE_BY_TAB[input.topLevelTab];

    const activeMode =
        modes.find((mode) => mode.modeKey === persistedModeKey) ??
        modes.find((mode) => mode.modeKey === fallbackModeKey) ??
        modes.at(0);

    if (!activeMode) {
        throw new Error(`Failed to resolve active mode for tab "${input.topLevelTab}".`);
    }

    return { modes, activeMode, activeKey };
}

export const modeRouter = router({
    list: publicProcedure.input(modeListInputSchema).query(async ({ input }) => {
        const modes = await modeStore.listByProfileAndTab(input.profileId, input.topLevelTab);
        return { modes: modes.filter((mode) => mode.enabled) };
    }),
    getActive: publicProcedure.input(modeGetActiveInputSchema).query(async ({ input }) => {
        const { modes, activeMode } = await resolveActiveMode(input);
        return {
            activeMode,
            modes,
        };
    }),
    setActive: publicProcedure.input(modeSetActiveInputSchema).mutation(async ({ input }) => {
        const mode = await modeStore.getByProfileTabMode(input.profileId, input.topLevelTab, input.modeKey);
        if (!mode || !mode.enabled) {
            return {
                updated: false as const,
                reason: 'mode_not_found' as const,
            };
        }

        const activeKey = toActiveModeKey(input.topLevelTab, input.workspaceFingerprint);
        await settingsStore.setString(input.profileId, activeKey, mode.modeKey);

        await runtimeEventLogService.append({
            entityType: 'runtime',
            entityId: `mode:${input.topLevelTab}`,
            eventType: 'mode.active.set',
            payload: {
                profileId: input.profileId,
                topLevelTab: input.topLevelTab,
                modeKey: mode.modeKey,
                workspaceFingerprint: input.workspaceFingerprint ?? null,
            },
        });

        return {
            updated: true as const,
            mode,
        };
    }),
});
