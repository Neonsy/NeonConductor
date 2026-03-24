import { describe, expect, it } from 'vitest';

import {
    createDraftFromServer,
    isDraftValid,
    isWorkingDirectoryMode,
    parseTimeout,
} from '@/web/components/settings/appSettings/mcpSection.shared';

describe('mcpSection shared helpers', () => {
    it('hydrates editable draft state from a saved server without exposing secret values', () => {
        const draft = createDraftFromServer({
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
            tools: [],
            envKeys: ['MCP_TOKEN'],
        });

        expect(draft.label).toBe('Workspace MCP');
        expect(draft.argsText).toBe('server.js');
        expect(draft.envEntries).toEqual([
            expect.objectContaining({
                key: 'MCP_TOKEN',
                value: '',
            }),
        ]);
    });

    it('validates working-directory mode and timeout input without broad casts', () => {
        expect(isWorkingDirectoryMode('workspace_root')).toBe(true);
        expect(isWorkingDirectoryMode('something_else')).toBe(false);
        expect(parseTimeout('2500')).toBe(2500);
        expect(parseTimeout('0')).toBeUndefined();
        expect(
            isDraftValid({
                label: 'Server',
                command: 'node',
                argsText: '',
                workingDirectoryMode: 'fixed_path',
                fixedWorkingDirectory: '',
                timeoutText: '',
                enabled: true,
                envEntries: [],
            })
        ).toBe(false);
    });
});
