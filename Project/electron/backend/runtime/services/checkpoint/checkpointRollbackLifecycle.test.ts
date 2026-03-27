import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    checkpointChangesetStore: {
        getByCheckpointId: vi.fn(),
    },
    checkpointSnapshotStore: {
        listSnapshotEntries: vi.fn(),
    },
    checkpointStore: {
        getById: vi.fn(),
        listByExecutionTargetKey: vi.fn(),
    },
    buildSnapshotIndexFromCapture: vi.fn(),
    evaluateRevertApplicability: vi.fn(),
    listAffectedSessionsForExecutionTarget: vi.fn(),
    createCheckpointRecoverySafetyCheckpoint: vi.fn(),
    resolveCheckpointRecoveryTarget: vi.fn(),
    captureExecutionTargetSnapshot: vi.fn(),
    restoreExecutionTargetSnapshot: vi.fn(),
}));

vi.mock('@/app/backend/persistence/stores', () => ({
    checkpointChangesetStore: mocks.checkpointChangesetStore,
    checkpointSnapshotStore: mocks.checkpointSnapshotStore,
    checkpointStore: mocks.checkpointStore,
}));

vi.mock('@/app/backend/runtime/services/checkpoint/changeset', () => ({
    buildSnapshotIndexFromCapture: mocks.buildSnapshotIndexFromCapture,
    evaluateRevertApplicability: mocks.evaluateRevertApplicability,
}));

vi.mock('@/app/backend/runtime/services/checkpoint/executionTarget', () => ({
    listAffectedSessionsForExecutionTarget: mocks.listAffectedSessionsForExecutionTarget,
}));

vi.mock('@/app/backend/runtime/services/checkpoint/checkpointRecoveryShared', async () => {
    const actual =
        await vi.importActual<typeof import('@/app/backend/runtime/services/checkpoint/checkpointRecoveryShared')>(
            '@/app/backend/runtime/services/checkpoint/checkpointRecoveryShared'
        );

    return {
        ...actual,
        createCheckpointRecoverySafetyCheckpoint: mocks.createCheckpointRecoverySafetyCheckpoint,
        resolveCheckpointRecoveryTarget: mocks.resolveCheckpointRecoveryTarget,
    };
});

vi.mock('@/app/backend/runtime/services/checkpoint/nativeSnapshot', () => ({
    captureExecutionTargetSnapshot: mocks.captureExecutionTargetSnapshot,
    restoreExecutionTargetSnapshot: mocks.restoreExecutionTargetSnapshot,
}));

import { ok } from 'neverthrow';
import {
    buildCheckpointRollbackPreview,
    rollbackCheckpointLifecycle,
} from '@/app/backend/runtime/services/checkpoint/checkpointRollbackLifecycle';

describe('checkpointRollbackLifecycle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.checkpointStore.getById.mockResolvedValue({
            id: 'ckpt_1',
            sessionId: 'sess_1',
            threadId: 'thr_1',
            executionTargetKey: 'workspace:ws_1',
            executionTargetKind: 'workspace',
            executionTargetLabel: 'Workspace Root',
            workspaceFingerprint: 'ws_1',
            topLevelTab: 'agent',
            modeKey: 'code',
            createdAt: '2026-03-27T00:00:00.000Z',
            snapshotFileCount: 1,
        });
        mocks.checkpointStore.listByExecutionTargetKey.mockResolvedValue([]);
        mocks.listAffectedSessionsForExecutionTarget.mockResolvedValue([]);
        mocks.checkpointChangesetStore.getByCheckpointId.mockResolvedValue({
            id: 'chg_1',
            checkpointId: 'ckpt_1',
            executionTargetKey: 'workspace:ws_1',
            executionTargetKind: 'workspace',
            executionTargetLabel: 'Workspace Root',
            sessionId: 'sess_1',
            threadId: 'thr_1',
            changesetKind: 'run_capture',
            changeCount: 1,
            summary: 'Changed 1 file',
        });
        mocks.captureExecutionTargetSnapshot.mockResolvedValue(
            ok({
                fileCount: 1,
                files: [{ relativePath: 'a.txt', bytes: new Uint8Array([1]) }],
            })
        );
        mocks.resolveCheckpointRecoveryTarget.mockResolvedValue({
            workspaceContext: {
                kind: 'workspace',
                workspaceFingerprint: 'ws_1',
                absolutePath: 'C:/repo',
                label: 'Workspace Root',
                executionEnvironmentMode: 'local',
            },
            executionTarget: {
                absolutePath: 'C:/repo',
                executionTargetKey: 'workspace:ws_1',
            },
        });
        mocks.buildSnapshotIndexFromCapture.mockReturnValue(new Map());
        mocks.evaluateRevertApplicability.mockReturnValue({
            canRevertSafely: true,
        });
    });

    it('builds a blocked high-risk preview when the execution target cannot be resolved safely', async () => {
        mocks.listAffectedSessionsForExecutionTarget.mockResolvedValue([
            {
                sessionId: 'sess_other',
                threadId: 'thr_other',
                topLevelTab: 'agent',
                threadTitle: 'Other Chat',
            },
        ]);
        mocks.resolveCheckpointRecoveryTarget.mockResolvedValue(null);

        const preview = await buildCheckpointRollbackPreview({
            profileId: 'profile_local_default',
            checkpoint: await mocks.checkpointStore.getById(),
        });

        expect(preview).toMatchObject({
            checkpointId: 'ckpt_1',
            isSharedTarget: true,
            isHighRisk: true,
            recommendedAction: 'restore_checkpoint',
            hasChangeset: true,
            canRevertSafely: false,
            revertBlockedReason: 'workspace_unresolved',
        });
    });

    it('requires confirmation before rollback mutates the execution target', async () => {
        const result = await rollbackCheckpointLifecycle({
            profileId: 'profile_local_default',
            checkpointId: 'ckpt_1',
            confirm: false,
        });

        expect(result).toMatchObject({
            rolledBack: false,
            reason: 'confirmation_required',
            preview: {
                checkpointId: 'ckpt_1',
            },
        });
        expect(mocks.createCheckpointRecoverySafetyCheckpoint).not.toHaveBeenCalled();
        expect(mocks.restoreExecutionTargetSnapshot).not.toHaveBeenCalled();
    });

    it('creates a safety checkpoint before restoring snapshot entries', async () => {
        mocks.createCheckpointRecoverySafetyCheckpoint.mockResolvedValue(
            ok({
                id: 'ckpt_safety',
                sessionId: 'sess_1',
                threadId: 'thr_1',
                executionTargetKey: 'workspace:ws_1',
                executionTargetKind: 'workspace',
                executionTargetLabel: 'Workspace Root',
                topLevelTab: 'agent',
                modeKey: 'code',
            })
        );
        mocks.checkpointSnapshotStore.listSnapshotEntries.mockResolvedValue([
            {
                relativePath: 'a.txt',
                bytes: new Uint8Array([9]),
            },
        ]);
        mocks.restoreExecutionTargetSnapshot.mockResolvedValue(ok(undefined));

        const result = await rollbackCheckpointLifecycle({
            profileId: 'profile_local_default',
            checkpointId: 'ckpt_1',
            confirm: true,
        });

        expect(result).toMatchObject({
            rolledBack: true,
            checkpoint: {
                id: 'ckpt_1',
            },
            safetyCheckpoint: {
                id: 'ckpt_safety',
            },
        });
        expect(mocks.createCheckpointRecoverySafetyCheckpoint).toHaveBeenCalledWith(
            expect.objectContaining({
                summary: 'Safety checkpoint before restoring ckpt_1',
            })
        );
        expect(mocks.restoreExecutionTargetSnapshot).toHaveBeenCalledWith({
            workspaceRootPath: 'C:/repo',
            files: [
                {
                    relativePath: 'a.txt',
                    bytes: new Uint8Array([9]),
                },
            ],
        });
    });
});
