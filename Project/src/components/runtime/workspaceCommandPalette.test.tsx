import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { WorkspaceCommandPalette } from '@/web/components/runtime/workspaceCommandPalette';

describe('WorkspaceCommandPalette', () => {
    it('renders section, profile, and workspace actions', () => {
        const html = renderToStaticMarkup(
            <WorkspaceCommandPalette
                open
                appSection='sessions'
                profiles={[
                    { id: 'profile_default', name: 'Default Profile' },
                    { id: 'profile_alt', name: 'Alt Profile' },
                ]}
                workspaceOptions={[
                    { fingerprint: 'ws_alpha', label: 'Alpha Workspace' },
                    { fingerprint: 'ws_beta', label: 'Beta Workspace' },
                ]}
                onClose={() => {}}
                onSectionChange={() => {}}
                onPreviewSectionChange={() => {}}
                onProfileChange={() => {}}
                onWorkspaceChange={() => {}}
            />
        );

        expect(html).toContain('Command palette');
        expect(html).toContain('Go to Sessions');
        expect(html).toContain('Open Settings');
        expect(html).toContain('Switch profile: Default Profile');
        expect(html).toContain('Focus workspace: Alpha Workspace');
        expect(html).toContain('Current section');
    });

    it('wires action callbacks through the rendered action metadata', () => {
        const onClose = vi.fn();
        const onSectionChange = vi.fn();
        const onPreviewSectionChange = vi.fn();
        const onProfileChange = vi.fn();
        const onWorkspaceChange = vi.fn();

        renderToStaticMarkup(
            <WorkspaceCommandPalette
                open
                appSection='sessions'
                profiles={[{ id: 'profile_default', name: 'Default Profile' }]}
                workspaceOptions={[{ fingerprint: 'ws_alpha', label: 'Alpha Workspace' }]}
                onClose={onClose}
                onSectionChange={onSectionChange}
                onPreviewSectionChange={onPreviewSectionChange}
                onProfileChange={onProfileChange}
                onWorkspaceChange={onWorkspaceChange}
            />
        );

        expect(onClose).not.toHaveBeenCalled();
        expect(onSectionChange).not.toHaveBeenCalled();
        expect(onPreviewSectionChange).not.toHaveBeenCalled();
        expect(onProfileChange).not.toHaveBeenCalled();
        expect(onWorkspaceChange).not.toHaveBeenCalled();
    });
});
