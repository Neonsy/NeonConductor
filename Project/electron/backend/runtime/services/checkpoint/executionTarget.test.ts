import { describe, expect, it } from 'vitest';

import { resolveCheckpointExecutionTarget } from '@/app/backend/runtime/services/checkpoint/executionTarget';

describe('resolveCheckpointExecutionTarget', () => {
    it('distinguishes base workspace targets from worktree targets', () => {
        const workspaceTarget = resolveCheckpointExecutionTarget({
            kind: 'workspace',
            workspaceFingerprint: 'ws_1',
            label: 'Workspace Root',
            absolutePath: 'C:/repo',
            executionEnvironmentMode: 'local',
        });
        const worktreeTarget = resolveCheckpointExecutionTarget({
            kind: 'worktree',
            workspaceFingerprint: 'ws_1',
            label: 'Feature Worktree',
            absolutePath: 'C:/repo/.worktrees/feature',
            executionEnvironmentMode: 'worktree',
            worktree: {
                id: 'wt_1',
                profileId: 'profile_local_default',
                workspaceFingerprint: 'ws_1',
                branch: 'feature/native-checkpoints',
                baseBranch: 'main',
                absolutePath: 'C:/repo/.worktrees/feature',
                label: 'Feature Worktree',
                status: 'ready',
                createdAt: '2026-03-18T10:00:00.000Z',
                updatedAt: '2026-03-18T10:00:00.000Z',
                lastUsedAt: '2026-03-18T10:00:00.000Z',
            },
            baseWorkspace: {
                label: 'Workspace Root',
                absolutePath: 'C:/repo',
            },
        });

        expect(workspaceTarget).not.toBeNull();
        expect(worktreeTarget).not.toBeNull();
        if (!workspaceTarget || !worktreeTarget) {
            throw new Error('Expected execution targets to resolve.');
        }

        expect(workspaceTarget.executionTargetKind).toBe('workspace');
        expect(worktreeTarget.executionTargetKind).toBe('worktree');
        expect(workspaceTarget.executionTargetKey).not.toBe(worktreeTarget.executionTargetKey);
        expect(workspaceTarget.executionTargetKey.startsWith('workspace:')).toBe(true);
        expect(worktreeTarget.executionTargetKey.startsWith('worktree:')).toBe(true);
    });
});
