import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ResolvedWorkspaceContext } from '@/app/backend/runtime/contracts';
import type { ResolvedToolDefinition } from '@/app/backend/runtime/services/toolExecution/types';
import { resolveToolRequestContext } from '@/app/backend/runtime/services/toolExecution/toolRequestContextResolver';

const { findToolByIdMock, resolveExplicitMock } = vi.hoisted(() => ({
    findToolByIdMock: vi.fn(),
    resolveExplicitMock: vi.fn(),
}));

vi.mock('@/app/backend/runtime/services/toolExecution/lookup', () => ({
    findToolById: findToolByIdMock,
}));

vi.mock('@/app/backend/runtime/services/workspaceContext/service', () => ({
    workspaceContextService: {
        resolveExplicit: resolveExplicitMock,
    },
}));

describe('toolRequestContextResolver', () => {
    beforeEach(() => {
        findToolByIdMock.mockReset();
        resolveExplicitMock.mockReset();
    });

    it('returns a failed outcome when the tool is not found', async () => {
        findToolByIdMock.mockResolvedValue(null);

        const outcome = await resolveToolRequestContext({
            profileId: 'profile_default',
            toolId: 'missing_tool',
            topLevelTab: 'agent',
            modeKey: 'code',
            args: {},
        });

        expect(outcome).toMatchObject({
            kind: 'failed',
            toolId: 'missing_tool',
            error: 'tool_not_found',
        });
    });

    it('returns a failed outcome when run_command is missing a command argument', async () => {
        const definition: ResolvedToolDefinition = {
            tool: {
                id: 'run_command',
                label: 'Run Command',
                description: 'Run a shell command.',
                capabilities: ['shell'],
                requiresWorkspace: true,
                permissionPolicy: 'ask',
                allowsExternalPaths: false,
                allowsIgnoredPaths: false,
                mutability: 'mutating',
            },
            resource: 'tool:run_command',
            source: 'native',
        };
        findToolByIdMock.mockResolvedValue(definition);

        const outcome = await resolveToolRequestContext({
            profileId: 'profile_default',
            toolId: 'run_command',
            topLevelTab: 'agent',
            modeKey: 'code',
            args: {},
        });

        expect(outcome).toMatchObject({
            kind: 'failed',
            toolId: 'run_command',
            error: 'invalid_args',
        });
    });

    it('resolves workspace-backed file tools and rewrites relative paths', async () => {
        const definition: ResolvedToolDefinition = {
            tool: {
                id: 'read_file',
                label: 'Read File',
                description: 'Read a file.',
                capabilities: ['filesystem_read'],
                requiresWorkspace: true,
                permissionPolicy: 'allow',
                allowsExternalPaths: false,
                allowsIgnoredPaths: false,
                mutability: 'read_only',
            },
            resource: 'tool:read_file',
            source: 'native',
        };
        const workspaceContext: ResolvedWorkspaceContext = {
            kind: 'workspace',
            workspaceFingerprint: 'ws_alpha',
            label: 'Workspace Alpha',
            absolutePath: 'C:/workspace-alpha',
            executionEnvironmentMode: 'local',
        };
        findToolByIdMock.mockResolvedValue(definition);
        resolveExplicitMock.mockResolvedValue(workspaceContext);

        const outcome = await resolveToolRequestContext({
            profileId: 'profile_default',
            toolId: 'read_file',
            topLevelTab: 'agent',
            modeKey: 'code',
            workspaceFingerprint: 'ws_alpha',
            args: {
                path: 'docs/readme.md',
            },
        });

        expect(outcome).toMatchObject({
            workspaceRequirement: 'resolved',
            workspaceLabel: 'Workspace Alpha',
            workspaceRootPath: 'C:/workspace-alpha',
            executionArgs: {
                path: expect.stringContaining('workspace-alpha'),
            },
        });
        if ('kind' in outcome) {
            throw new Error('Expected a resolved request context, not a failed outcome.');
        }
        expect(outcome.resolvedWorkspacePath?.absolutePath).toContain('docs');
    });

    it('rewrites search_files paths through the same workspace boundary resolver', async () => {
        const definition: ResolvedToolDefinition = {
            tool: {
                id: 'search_files',
                label: 'Search Files',
                description: 'Search for fixed text.',
                capabilities: ['filesystem_read'],
                requiresWorkspace: true,
                permissionPolicy: 'allow',
                allowsExternalPaths: false,
                allowsIgnoredPaths: false,
                mutability: 'read_only',
            },
            resource: 'tool:search_files',
            source: 'native',
        };
        const workspaceContext: ResolvedWorkspaceContext = {
            kind: 'workspace',
            workspaceFingerprint: 'ws_alpha',
            label: 'Workspace Alpha',
            absolutePath: 'C:/workspace-alpha',
            executionEnvironmentMode: 'local',
        };
        findToolByIdMock.mockResolvedValue(definition);
        resolveExplicitMock.mockResolvedValue(workspaceContext);

        const outcome = await resolveToolRequestContext({
            profileId: 'profile_default',
            toolId: 'search_files',
            topLevelTab: 'agent',
            modeKey: 'ask',
            workspaceFingerprint: 'ws_alpha',
            args: {
                path: 'src',
                query: 'ExampleValue',
            },
        });

        if ('kind' in outcome) {
            throw new Error('Expected a resolved request context, not a failed outcome.');
        }

        expect(outcome.executionArgs).toMatchObject({
            path: expect.stringContaining('workspace-alpha'),
            query: 'ExampleValue',
        });
        expect(outcome.resolvedWorkspacePath?.absolutePath).toContain('src');
    });

    it('rewrites write_file paths through the same workspace boundary resolver', async () => {
        const definition: ResolvedToolDefinition = {
            tool: {
                id: 'write_file',
                label: 'Write File',
                description: 'Write a file.',
                capabilities: ['filesystem_write'],
                requiresWorkspace: true,
                permissionPolicy: 'ask',
                allowsExternalPaths: false,
                allowsIgnoredPaths: false,
                mutability: 'mutating',
            },
            resource: 'tool:write_file',
            source: 'native',
        };
        const workspaceContext: ResolvedWorkspaceContext = {
            kind: 'workspace',
            workspaceFingerprint: 'ws_alpha',
            label: 'Workspace Alpha',
            absolutePath: 'C:/workspace-alpha',
            executionEnvironmentMode: 'local',
        };
        findToolByIdMock.mockResolvedValue(definition);
        resolveExplicitMock.mockResolvedValue(workspaceContext);

        const outcome = await resolveToolRequestContext({
            profileId: 'profile_default',
            toolId: 'write_file',
            topLevelTab: 'agent',
            modeKey: 'code',
            workspaceFingerprint: 'ws_alpha',
            args: {
                path: 'src/generated/example.ts',
                content: 'export const value = 1;\n',
            },
        });

        if ('kind' in outcome) {
            throw new Error('Expected a resolved request context, not a failed outcome.');
        }

        expect(outcome.executionArgs).toMatchObject({
            path: expect.stringContaining('workspace-alpha'),
            content: 'export const value = 1;\n',
        });
        expect(outcome.resolvedWorkspacePath?.absolutePath).toContain('generated');
    });

    it('attaches shell approval context for run_command inputs', async () => {
        const definition: ResolvedToolDefinition = {
            tool: {
                id: 'run_command',
                label: 'Run Command',
                description: 'Run a shell command.',
                capabilities: ['shell'],
                requiresWorkspace: true,
                permissionPolicy: 'ask',
                allowsExternalPaths: false,
                allowsIgnoredPaths: false,
                mutability: 'mutating',
            },
            resource: 'tool:run_command',
            source: 'native',
        };
        const workspaceContext: ResolvedWorkspaceContext = {
            kind: 'workspace',
            workspaceFingerprint: 'ws_alpha',
            label: 'Workspace Alpha',
            absolutePath: 'C:/workspace-alpha',
            executionEnvironmentMode: 'local',
        };
        findToolByIdMock.mockResolvedValue(definition);
        resolveExplicitMock.mockResolvedValue(workspaceContext);

        const outcome = await resolveToolRequestContext({
            profileId: 'profile_default',
            toolId: 'run_command',
            topLevelTab: 'agent',
            modeKey: 'code',
            workspaceFingerprint: 'ws_alpha',
            args: {
                command: '  echo hello world  ',
            },
        });

        if ('kind' in outcome) {
            throw new Error('Expected a resolved request context, not a failed outcome.');
        }

        expect(outcome.shellApprovalContext).toMatchObject({
            commandText: 'echo hello world',
            approvalCandidates: [
                expect.objectContaining({ label: 'echo hello' }),
                expect.objectContaining({ label: 'echo' }),
            ],
        });
    });
});
