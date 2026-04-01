import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const listServersInvalidate = vi.fn();
const getServerInvalidate = vi.fn();

vi.mock('@/web/trpc/client', () => ({
    trpc: {
        useUtils: () => ({
            mcp: {
                listServers: {
                    invalidate: listServersInvalidate,
                },
                getServer: {
                    invalidate: getServerInvalidate,
                },
            },
        }),
        mcp: {
            listServers: {
                useQuery: () => ({
                    data: {
                        servers: [
                            {
                                id: 'mcp_alpha',
                                label: 'Workspace MCP',
                                transport: 'stdio',
                                command: 'node',
                                args: ['server.js'],
                                workingDirectoryMode: 'workspace_root',
                                enabled: true,
                                connectionState: 'connected',
                                updatedAt: '2026-03-23T12:00:00.000Z',
                                toolDiscoveryState: 'ready',
                                tools: [
                                    {
                                        name: 'echo_text',
                                        description: 'Echoes text back.',
                                        inputSchema: {
                                            type: 'object',
                                            properties: {
                                                text: {
                                                    type: 'string',
                                                },
                                            },
                                        },
                                        mutability: 'mutating',
                                    },
                                ],
                                envKeys: ['MCP_TOKEN', 'ANOTHER_KEY'],
                            },
                        ],
                    },
                }),
            },
            createServer: {
                useMutation: () => ({
                    isPending: false,
                    mutateAsync: vi.fn(),
                }),
            },
            updateServer: {
                useMutation: () => ({
                    isPending: false,
                    mutateAsync: vi.fn(),
                }),
            },
            deleteServer: {
                useMutation: () => ({
                    isPending: false,
                    mutateAsync: vi.fn(),
                }),
            },
            connect: {
                useMutation: () => ({
                    isPending: false,
                    mutateAsync: vi.fn(),
                }),
            },
            disconnect: {
                useMutation: () => ({
                    isPending: false,
                    mutateAsync: vi.fn(),
                }),
            },
            setEnvSecrets: {
                useMutation: () => ({
                    isPending: false,
                    mutateAsync: vi.fn(),
                }),
            },
            setToolMutability: {
                useMutation: () => ({
                    isPending: false,
                    mutateAsync: vi.fn(),
                }),
            },
        },
    },
}));

import { McpSettingsSection } from '@/web/components/settings/appSettings/mcpSection';

describe('McpSettingsSection', () => {
    it('renders discovered tools, env key names, and workspace-root connect guidance without exposing secret values', () => {
        const html = renderToStaticMarkup(<McpSettingsSection profileId='profile_default' />);

        expect(html).toContain('Workspace MCP');
        expect(html).toContain('connected');
        expect(html).toContain('ready');
        expect(html).toContain('echo_text');
        expect(html).toContain('Echoes text back.');
        expect(html).toContain('mutating');
        expect(html).toContain('Mark Read-Only');
        expect(html).toContain('MCP_TOKEN');
        expect(html).toContain('ANOTHER_KEY');
        expect(html).toContain('Env values are write-only after save.');
        expect(html).toContain('Select a workspace before connecting this server.');
        expect(html).not.toContain('top-secret');
    });
});
