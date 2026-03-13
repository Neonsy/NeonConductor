import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { WorkspaceSurfaceHeader } from '@/web/components/runtime/workspaceSurfaceHeader';

describe('workspace surface header', () => {
    it('keeps the header focused on global workspace context instead of modal settings controls', () => {
        const html = renderToStaticMarkup(
            <WorkspaceSurfaceHeader
                appSection='sessions'
                primarySection='sessions'
                profiles={[{ id: 'profile_default', name: 'Local Default' }]}
                resolvedProfileId='profile_default'
                isSwitchingProfile={false}
                workspaceOptions={[{ fingerprint: 'ws_alpha', label: 'Workspace Alpha' }]}
                selectedWorkspaceFingerprint='ws_alpha'
                onProfileChange={vi.fn()}
                onWorkspaceChange={vi.fn()}
                onPrimarySectionChange={vi.fn()}
                onOpenSettings={vi.fn()}
                onReturnToPrimarySection={vi.fn()}
                onOpenCommandPalette={vi.fn()}
            />
        );

        expect(html).toContain('Sessions');
        expect(html).toContain('Workspaces');
        expect(html).toContain('Workspace Alpha');
        expect(html).toContain('Local Default');
        expect(html).toContain('Search');
        expect(html).toContain('App');
        expect(html).not.toContain('Orchestrator');
        expect(html).not.toContain('Agent');
        expect(html).not.toContain('Chat');
    });
});
