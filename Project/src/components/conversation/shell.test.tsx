import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/web/components/conversation/shell/useConversationShellController', () => ({
    useConversationShellController: () => ({
        sidebarPaneProps: {},
        workspaceSectionProps: {},
        messageEditDialogProps: {},
        branchWorkflowDialogProps: {},
    }),
}));

vi.mock('@/web/components/conversation/sidebar/conversationSidebarPane', () => ({
    ConversationSidebarPane: () => <div>Sidebar Pane</div>,
}));

vi.mock('@/web/components/conversation/shell/composition/conversationWorkspaceSection', () => ({
    ConversationWorkspaceSection: () => <div>Workspace Section</div>,
}));

vi.mock('@/web/components/conversation/panels/messageEditDialog', () => ({
    MessageEditDialog: () => <div>Message Edit Dialog</div>,
}));

vi.mock('@/web/components/conversation/panels/branchWorkflowDialog', () => ({
    BranchWorkflowDialog: () => <div>Branch Workflow Dialog</div>,
}));

import { ConversationShell } from '@/web/components/conversation/shell';

describe('conversation shell', () => {
    it('renders the thin shell composition boundaries', () => {
        const html = renderToStaticMarkup(
            <ConversationShell
                profileId='profile_default'
                profiles={[{ id: 'profile_default', name: 'Default' }]}
                selectedProfileId='profile_default'
                topLevelTab='chat'
                modeKey='chat'
                modes={[]}
                onModeChange={vi.fn()}
                onTopLevelTabChange={vi.fn()}
                onProfileChange={vi.fn()}
            />
        );

        expect(html).toContain('Sidebar Pane');
        expect(html).toContain('Workspace Section');
        expect(html).toContain('Message Edit Dialog');
        expect(html).toContain('Branch Workflow Dialog');
    });
});
