import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveRuntimeToolsForMode } from '@/app/backend/runtime/services/runExecution/tools';
import type { RuntimeToolGuidanceContext } from '@/app/backend/runtime/services/runExecution/types';
import type { ModeDefinition } from '@/shared/contracts';

const { toolStoreListMock, mcpListRuntimeToolsMock } = vi.hoisted(() => ({
    toolStoreListMock: vi.fn(),
    mcpListRuntimeToolsMock: vi.fn(),
}));

vi.mock('@/app/backend/persistence/stores', () => ({
    toolStore: {
        list: toolStoreListMock,
    },
}));

vi.mock('@/app/backend/runtime/services/mcp/service', () => ({
    mcpService: {
        listRuntimeTools: mcpListRuntimeToolsMock,
    },
}));

function buildMode(toolCapabilities: NonNullable<ModeDefinition['executionPolicy']['toolCapabilities']>): ModeDefinition {
    return {
        id: 'mode_test_agent_code',
        profileId: 'profile_default',
        topLevelTab: 'agent',
        modeKey: 'code',
        label: 'Agent Code',
        assetKey: 'agent.code',
        prompt: {},
        executionPolicy: {
            toolCapabilities,
        },
        source: 'test',
        sourceKind: 'system_seed',
        scope: 'system',
        enabled: true,
        precedence: 0,
        createdAt: '2026-04-01T00:00:00.000Z',
        updatedAt: '2026-04-01T00:00:00.000Z',
    };
}

function buildGuidanceContext(): RuntimeToolGuidanceContext {
    return {
        platform: process.platform === 'win32' ? 'win32' : process.platform === 'darwin' ? 'darwin' : 'linux',
        shellFamily: process.platform === 'win32' ? 'powershell' : 'posix_sh',
        shellExecutable: process.platform === 'win32' ? 'pwsh.exe' : '/bin/sh',
        shellResolved: true,
        vendoredRipgrepAvailable: true,
    };
}

describe('resolveRuntimeToolsForMode', () => {
    beforeEach(() => {
        toolStoreListMock.mockReset();
        mcpListRuntimeToolsMock.mockReset();
        toolStoreListMock.mockResolvedValue([
            {
                id: 'write_file',
                label: 'Write File',
                description: 'Write a file.',
                permissionPolicy: 'ask',
                capabilities: ['filesystem_write'],
                requiresWorkspace: true,
                allowsExternalPaths: false,
                allowsIgnoredPaths: false,
            },
            {
                id: 'run_command',
                label: 'Run Command',
                description: 'Run a command.',
                permissionPolicy: 'ask',
                capabilities: ['shell'],
                requiresWorkspace: true,
                allowsExternalPaths: false,
                allowsIgnoredPaths: false,
            },
            {
                id: 'list_files',
                label: 'List Files',
                description: 'List files.',
                permissionPolicy: 'ask',
                capabilities: ['filesystem_read'],
                requiresWorkspace: true,
                allowsExternalPaths: false,
                allowsIgnoredPaths: false,
            },
            {
                id: 'search_files',
                label: 'Search Files',
                description: 'Search files.',
                permissionPolicy: 'ask',
                capabilities: ['filesystem_read'],
                requiresWorkspace: true,
                allowsExternalPaths: false,
                allowsIgnoredPaths: false,
            },
            {
                id: 'read_file',
                label: 'Read File',
                description: 'Read a file.',
                permissionPolicy: 'ask',
                capabilities: ['filesystem_read'],
                requiresWorkspace: true,
                allowsExternalPaths: false,
                allowsIgnoredPaths: false,
            },
        ]);
        mcpListRuntimeToolsMock.mockResolvedValue([]);
    });

    it('orders the built-in core deliberately for write-capable modes', async () => {
        const tools = await resolveRuntimeToolsForMode({
            mode: buildMode(['filesystem_read', 'filesystem_write', 'shell']),
        });

        expect(tools.map((tool) => tool.id)).toEqual([
            'list_files',
            'read_file',
            'search_files',
            'write_file',
            'run_command',
        ]);
    });

    it('exposes write_file to custom modes that already declare filesystem_write', async () => {
        const tools = await resolveRuntimeToolsForMode({
            mode: buildMode(['filesystem_read', 'filesystem_write']),
        });

        expect(tools.map((tool) => tool.id)).toEqual(['list_files', 'read_file', 'search_files', 'write_file']);
    });

    it('keeps edited base descriptions while appending runtime guidance', async () => {
        toolStoreListMock.mockResolvedValue([
            {
                id: 'write_file',
                label: 'Write File',
                description: 'Base editable write description.',
                permissionPolicy: 'ask',
                capabilities: ['filesystem_write'],
                requiresWorkspace: true,
                allowsExternalPaths: false,
                allowsIgnoredPaths: false,
            },
        ]);

        const tools = await resolveRuntimeToolsForMode({
            mode: buildMode(['filesystem_write']),
            guidanceContext: buildGuidanceContext(),
        });

        expect(tools[0]?.description).toContain('Base editable write description.');
        expect(tools[0]?.description).toContain('Prefer this tool for ordinary whole-file creation or replacement');
    });
});
