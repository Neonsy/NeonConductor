import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/web/components/runtime/workspaceSurfaceController', () => ({
    useWorkspaceSurfaceController: vi.fn(),
}));

import { WorkspaceSurface } from '@/web/components/runtime/workspaceSurface';
import { useWorkspaceSurfaceController } from '@/web/components/runtime/workspaceSurfaceController';

function createControllerState(overrides: Record<string, unknown> = {}) {
    return {
        appSection: 'sessions',
        profiles: [
            {
                id: 'profile_default',
                name: 'Local Default',
                createdAt: '2026-03-19T10:00:00.000Z',
                updatedAt: '2026-03-19T10:00:00.000Z',
                isActive: true,
            },
        ],
        resolvedProfileId: 'profile_default',
        profilePending: false,
        profileErrorMessage: undefined,
        hasProfiles: true,
        hasResolvedInitialMode: true,
        modePending: false,
        modeErrorMessage: undefined,
        profileSetActiveMutation: {
            isPending: false,
        },
        setActiveModeMutation: {
            isPending: false,
        },
        topLevelTab: 'chat',
        currentWorkspaceFingerprint: undefined,
        modes: [],
        activeModeKey: 'chat',
        workspaceRoots: [],
        selectedWorkspaceRoot: undefined,
        isCommandPaletteOpen: false,
        setIsCommandPaletteOpen: vi.fn(),
        setAppSection: vi.fn(),
        openSettings: vi.fn(),
        returnToPrimarySection: vi.fn(),
        setTopLevelTab: vi.fn(),
        setCurrentWorkspaceFingerprint: vi.fn(),
        setResolvedProfile: vi.fn(),
        selectProfile: vi.fn(async () => undefined),
        selectMode: vi.fn(async () => undefined),
        ...overrides,
    };
}

const controllerSessions = createControllerState();

vi.mock('@/web/trpc/client', () => ({
    trpc: {
        useUtils: () => ({}),
    },
}));

vi.mock('@/web/components/runtime/useWorkspaceBootPrefetch', () => ({
    useWorkspaceBootPrefetch: vi.fn(),
}));

vi.mock('@/web/components/runtime/useRendererBootReadySignal', () => ({
    useRendererBootReadySignal: () => ({ readySignalState: 'sent' as const }),
}));

vi.mock('@/web/components/runtime/useRendererBootStatusReporter', () => ({
    useRendererBootStatusReporter: vi.fn(),
}));

vi.mock('@/web/components/runtime/bootReadiness', () => ({
    INITIAL_CONVERSATION_SHELL_BOOT_CHROME_READINESS: {
        shellBootstrapSettled: true,
        shellBootstrapErrorMessage: undefined,
    },
    getWorkspaceBootDiagnostics: () => ({
        status: 'ready',
        hasCriticalError: false,
    }),
    isWorkspaceBootReady: () => true,
}));

vi.mock('@/web/components/runtime/workspaceBootDiagnosticsPanel', () => ({
    WorkspaceBootDiagnosticsPanel: () => <div>boot diagnostics</div>,
}));

vi.mock('@/web/components/runtime/workspaceCommandPalette', () => ({
    WorkspaceCommandPalette: () => <div>command palette</div>,
}));

vi.mock('@/web/components/runtime/workspaceSurfaceHeader', () => ({
    WorkspaceSurfaceHeader: () => <header>surface header</header>,
}));

vi.mock('@/web/components/conversation/shell', () => ({
    ConversationShell: () => <div>conversation shell</div>,
}));

vi.mock('@/web/components/settings/settingsWorkspace', () => ({
    SettingsWorkspace: () => <div>settings workspace</div>,
}));

describe('workspace surface', () => {
    it('renders only the conversation shell while the sessions section is active', () => {
        vi.mocked(useWorkspaceSurfaceController).mockReturnValue(
            controllerSessions as unknown as ReturnType<typeof useWorkspaceSurfaceController>
        );

        const html = renderToStaticMarkup(<WorkspaceSurface />);

        expect(html).toContain('surface header');
        expect(html).toContain('conversation shell');
        expect(html).not.toContain('settings workspace');
    });

    it('renders only the settings workspace while the settings section is active', () => {
        vi.mocked(useWorkspaceSurfaceController).mockReturnValue(
            createControllerState({
                appSection: 'settings',
            }) as unknown as ReturnType<typeof useWorkspaceSurfaceController>
        );

        const html = renderToStaticMarkup(<WorkspaceSurface />);

        expect(html).toContain('surface header');
        expect(html).toContain('settings workspace');
        expect(html).not.toContain('conversation shell');
    });
});
