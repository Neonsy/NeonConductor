import type { ConversationModeOption } from '@/web/components/conversation/shell/workspace/helpers';
import type { ConversationShellBootChromeReadiness } from '@/web/components/runtime/bootReadiness';

import type { TopLevelTab } from '@/shared/contracts';

import { useConversationShellRuntimeState } from '@/web/components/conversation/shell/useConversationShellRuntimeState';
import { useConversationShellViewControllers } from '@/web/components/conversation/shell/useConversationShellViewControllers';

export { buildResolvedContextStateQueryInput } from '@/web/components/conversation/shell/conversationShellRuntimeState';

export interface ConversationShellProps {
    profileId: string;
    profiles: Array<{ id: string; name: string }>;
    selectedProfileId: string | undefined;
    topLevelTab: TopLevelTab;
    selectedWorkspaceFingerprint?: string;
    modeKey: string;
    modes: ConversationModeOption[];
    onModeChange: (modeKey: string) => void;
    onTopLevelTabChange: (nextTab: TopLevelTab) => void;
    onSelectedWorkspaceFingerprintChange?: (workspaceFingerprint: string | undefined) => void;
    onProfileChange: (profileId: string) => void;
    onBootChromeReadyChange?: (readiness: ConversationShellBootChromeReadiness) => void;
}

export interface UseConversationShellControllerInput extends ConversationShellProps {
    isSidebarCollapsed: boolean;
    onToggleSidebarCollapsed: () => void;
}

export function useConversationShellController(input: UseConversationShellControllerInput) {
    const runtimeState = useConversationShellRuntimeState(input);
    return useConversationShellViewControllers(runtimeState);
}
