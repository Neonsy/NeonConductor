import { describe, expect, it } from 'vitest';

import { buildRollbackWarningLines, resolveSelectedDiffPath } from '@/web/components/conversation/panels/diffCheckpointPanelState';

describe('resolveSelectedDiffPath', () => {
    it('keeps the preferred path while it still exists and falls back when it disappears', () => {
        const selectedDiff = {
            id: 'diff_1',
            profileId: 'profile_default',
            sessionId: 'sess_1',
            runId: 'run_1',
            summary: 'Diff',
            artifact: {
                kind: 'git',
                workspaceRootPath: 'C:\\workspace',
                fileCount: 2,
                files: [
                    { path: 'src/app.ts', status: 'modified' },
                    { path: 'src/lib.ts', status: 'added' },
                ],
            },
            createdAt: '2026-03-10T10:00:00.000Z',
            updatedAt: '2026-03-10T10:00:00.000Z',
        } as const;

        expect(
            resolveSelectedDiffPath({
                selectedDiff: selectedDiff as never,
                preferredPath: 'src/lib.ts',
            })
        ).toBe('src/lib.ts');

        expect(
            resolveSelectedDiffPath({
                selectedDiff: {
                    ...selectedDiff,
                    artifact: {
                        ...selectedDiff.artifact,
                        fileCount: 1,
                        files: [{ path: 'src/app.ts', status: 'modified' }],
                    },
                } as never,
                preferredPath: 'src/lib.ts',
            })
        ).toBe('src/app.ts');
    });
});

describe('buildRollbackWarningLines', () => {
    it('describes isolated and shared rollback previews with backend-owned warning text', () => {
        expect(
            buildRollbackWarningLines({
                checkpointId: 'ckpt_1',
                executionTargetKey: 'workspace:c:/repo',
                executionTargetKind: 'workspace',
                executionTargetLabel: 'Workspace Root',
                isSharedTarget: false,
                hasLaterForeignChanges: false,
                isHighRisk: false,
                affectedSessions: [
                    {
                        sessionId: 'sess_1',
                        threadId: 'thr_1',
                        topLevelTab: 'agent',
                        threadTitle: 'Solo Chat',
                    },
                ],
            })
        ).toEqual({
            tone: 'isolated',
            lines: ['This checkpoint targets an isolated execution path.', 'Affected chats: Solo Chat'],
        });

        expect(
            buildRollbackWarningLines({
                checkpointId: 'ckpt_2',
                executionTargetKey: 'workspace:c:/repo',
                executionTargetKind: 'workspace',
                executionTargetLabel: 'Workspace Root',
                isSharedTarget: true,
                hasLaterForeignChanges: true,
                isHighRisk: true,
                affectedSessions: [
                    {
                        sessionId: 'sess_1',
                        threadId: 'thr_1',
                        topLevelTab: 'agent',
                        threadTitle: 'Chat A',
                    },
                    {
                        sessionId: 'sess_2',
                        threadId: 'thr_2',
                        topLevelTab: 'agent',
                        threadTitle: 'Chat B',
                    },
                ],
            })
        ).toEqual({
            tone: 'warning',
            lines: [
                'This target is shared. Rolling back here will also affect other chats on the same resolved path.',
                'Later checkpoints from other chats exist on this same target. This rollback is high risk.',
                'Affected chats: Chat A, Chat B',
            ],
        });
    });
});
