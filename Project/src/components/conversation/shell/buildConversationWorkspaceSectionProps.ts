import type { ShellWorkspaceCompositionInput } from '@/web/components/conversation/shell/useConversationShellViewControllers.types';

export function buildConversationWorkspaceSectionProps(input: ShellWorkspaceCompositionInput) {
    return {
        header: {
            selectedThread: input.shellViewModel.selectedThread,
            streamState: input.streamState,
            ...(input.streamErrorMessage !== undefined ? { streamErrorMessage: input.streamErrorMessage } : {}),
            lastSequence: input.queries.shellBootstrapQuery.data?.lastSequence ?? 0,
            tabSwitchNotice: input.tabSwitchNotice,
            topLevelTab: input.topLevelTab,
            isSidebarCollapsed: input.isSidebarCollapsed,
        },
        panel: input.panel,
        onToggleSidebar: input.onToggleSidebarCollapsed,
        onTopLevelTabChange: input.onTopLevelTabChange,
    };
}
