import type { TopLevelTab } from '@/app/backend/runtime/contracts';

export function resolveTabSwitchNotice(
    currentTab: TopLevelTab,
    nextTab: TopLevelTab
): {
    shouldSwitch: boolean;
    notice?: string;
} {
    if (currentTab === nextTab) {
        return {
            shouldSwitch: false,
        };
    }

    return {
        shouldSwitch: true,
        notice: `Switched to ${nextTab} to open this thread.`,
    };
}
