import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/web/components/workspaces/useWorkspacesSurfaceController', () => ({
    useWorkspacesSurfaceController: () => ({
        providers: [],
        providerModels: [],
        runtimeDefaults: undefined,
        selectedWorkspace: {
            fingerprint: 'wsf_alpha',
            label: 'Alpha Workspace',
            absolutePath: 'C:/alpha',
            updatedAt: '2026-03-24T00:00:00.000Z',
        },
        selectedWorkspacePreference: undefined,
        selectedWorkspaceThreads: [{ id: 'thr_1' }],
        selectedWorkspaceSessions: [{ id: 'sess_1', updatedAt: '2026-03-24T00:00:00.000Z', runStatus: 'idle' }],
        selectedWorkspaceSandboxes: [],
        selectedWorkspaceRegistry: {
            resolved: {
                modes: [],
                rulesets: [],
                skillfiles: [],
            },
        },
        isCreatingWorkspace: false,
        isRefreshingRegistry: false,
        isDeletingWorkspaceConversations: false,
        createWorkspace: vi.fn(),
        refreshRegistry: vi.fn(),
        deleteWorkspaceConversations: vi.fn(),
    }),
}));

vi.mock('@/web/components/workspaces/workspaceDetailsPanel', () => ({
    WorkspaceDetailsPanel: () => <div>Workspace Details Panel</div>,
}));

vi.mock('@/web/components/workspaces/workspaceCreateDialog', () => ({
    WorkspaceCreateDialog: () => <div>Workspace Create Dialog</div>,
}));

vi.mock('@/web/components/workspaces/workspaceDeleteConversationsDialog', () => ({
    WorkspaceDeleteConversationsDialog: () => <div>Workspace Delete Dialog</div>,
}));

import { WorkspacesSurface } from '@/web/components/workspaces/workspacesSurface';

describe('workspaces surface', () => {
    it('renders the refactored workspace boundaries', () => {
        const html = renderToStaticMarkup(
            <WorkspacesSurface
                profileId='profile_default'
                workspaceRoots={[
                    {
                        fingerprint: 'wsf_alpha',
                        label: 'Alpha Workspace',
                        absolutePath: 'C:/alpha',
                        updatedAt: '2026-03-24T00:00:00.000Z',
                    },
                ]}
                selectedWorkspaceFingerprint='wsf_alpha'
                onSelectedWorkspaceFingerprintChange={vi.fn()}
                onOpenSessions={vi.fn()}
                onCreateThreadForWorkspace={vi.fn()}
            />
        );

        expect(html).toContain('Alpha Workspace');
        expect(html).toContain('Workspace Details Panel');
        expect(html).toContain('Workspace Create Dialog');
        expect(html).toContain('Workspace Delete Dialog');
    });
});
