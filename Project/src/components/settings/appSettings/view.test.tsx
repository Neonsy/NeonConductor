import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/web/components/settings/appSettings/mcpSection', () => ({
    McpSettingsSection: () => <div>mcp section</div>,
}));

vi.mock('@/web/components/window/privacyModeToggle', () => ({
    default: () => <div>privacy toggle</div>,
}));

vi.mock('@/web/components/ui/confirmDialog', () => ({
    ConfirmDialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/web/trpc/client', () => ({
    trpc: {
        runtime: {
            factoryReset: {
                useMutation: () => ({
                    isPending: false,
                    mutateAsync: vi.fn(),
                }),
            },
        },
    },
}));

import { AppSettingsView } from '@/web/components/settings/appSettings/view';

describe('AppSettingsView', () => {
    it('renders the MCP subsection inside App settings', () => {
        const html = renderToStaticMarkup(<AppSettingsView profileId='profile_default' subsection='mcp' />);

        expect(html).toContain('MCP');
        expect(html).toContain('mcp section');
    });
});
