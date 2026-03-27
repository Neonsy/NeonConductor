import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    checkpointChangesetStore: {
        getByCheckpointId: vi.fn(),
        replaceForCheckpoint: vi.fn(),
    },
    checkpointSnapshotStore: {
        listSnapshotEntries: vi.fn(),
    },
    checkpointStore: {
        getById: vi.fn(),
    },
    buildSnapshotIndexFromCapture: vi.fn(),
    buildSnapshotIndexFromEntries: vi.fn(),
    deriveChangesetFromSnapshots: vi.fn(),
    evaluateRevertApplicability: vi.fn(),
    buildCheckpointRollbackPreview: vi.fn(),
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
    buildSnapshotIndexFromEntries: mocks.buildSnapshotIndexFromEntries,
    deriveChangesetFromSnapshots: mocks.deriveChangesetFromSnapshots,
    evaluateRevertApplicability: mocks.evaluateRevertApplicability,
}));

vi.mock('@/app/backend/runtime/services/checkpoint/checkpointRollbackLifecycle', () => ({
    buildCheckpointRollbackPreview: mocks.buildCheckpointRollbackPreview,
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

import { revertCheckpointChangesetLifecycle } from '@/app/backend/runtime/services/checkpoint/checkpointRevertLifecycle';

describe('checkpointRevertLifecycle', () => {
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
        });
    });

    it('fails closed when the preview reports no revertable changeset', async () => {
        mocks.buildCheckpointRollbackPreview.mockResolvedValue({
            checkpointId: 'ckpt_1',
            executionTargetKey: 'workspace:ws_1',
            executionTargetKind: 'workspace',
            executionTargetLabel: 'Workspace Root',
            isSharedTarget: false,
            hasLaterForeignChanges: false,
            isHighRisk: false,
            affectedSessions: [],
            hasChangeset: false,
            recommendedAction: 'restore_checkpoint',
            canRevertSafely: false,
            revertBlockedReason: 'changeset_missing',
        });

        const result = await revertCheckpointChangesetLifecycle({
            profileId: 'profile_local_default',
            checkpointId: 'ckpt_1',
            confirm: true,
        });

        expect(result).toMatchObject({
            reverted: false,
            reason: 'changeset_missing',
            preview: {
                checkpointId: 'ckpt_1',
            },
        });
        expect(mocks.createCheckpointRecoverySafetyCheckpoint).not.toHaveBeenCalled();
    });

    it('fails closed when the execution target cannot be resolved after preview approval', async () => {
        mocks.buildCheckpointRollbackPreview.mockResolvedValue({
            checkpointId: 'ckpt_1',
            executionTargetKey: 'workspace:ws_1',
            executionTargetKind: 'workspace',
            executionTargetLabel: 'Workspace Root',
            isSharedTarget: false,
            hasLaterForeignChanges: false,
            isHighRisk: false,
            affectedSessions: [],
            hasChangeset: true,
            changeset: { id: 'chg_1' },
            recommendedAction: 'restore_checkpoint',
            canRevertSafely: true,
        });
        mocks.resolveCheckpointRecoveryTarget.mockResolvedValue(null);

        const result = await revertCheckpointChangesetLifecycle({
            profileId: 'profile_local_default',
            checkpointId: 'ckpt_1',
            confirm: true,
        });

        expect(result).toMatchObject({
            reverted: false,
            reason: 'workspace_unresolved',
            changeset: { id: 'chg_1' },
        });
    });
});
