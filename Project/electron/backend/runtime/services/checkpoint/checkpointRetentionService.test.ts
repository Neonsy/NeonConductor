import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    checkpointChangesetStore: {
        listChangeCountsByCheckpointIds: vi.fn(),
    },
    checkpointSnapshotStore: {
        pruneUnreferencedBlobs: vi.fn(),
    },
    checkpointStore: {
        deleteByIds: vi.fn(),
        listByProfile: vi.fn(),
        listBySession: vi.fn(),
    },
    compactCheckpointStorage: vi.fn(),
    applyRetentionDispositions: vi.fn(),
    buildCleanupPreview: vi.fn(),
    classifyCheckpointRetention: vi.fn(),
}));

vi.mock('@/app/backend/persistence/stores', () => ({
    checkpointChangesetStore: mocks.checkpointChangesetStore,
    checkpointSnapshotStore: mocks.checkpointSnapshotStore,
    checkpointStore: mocks.checkpointStore,
}));

vi.mock('@/app/backend/runtime/services/checkpoint/compaction', () => ({
    compactCheckpointStorage: mocks.compactCheckpointStorage,
}));

vi.mock('@/app/backend/runtime/services/checkpoint/retention', () => ({
    applyRetentionDispositions: mocks.applyRetentionDispositions,
    buildCleanupPreview: mocks.buildCleanupPreview,
    classifyCheckpointRetention: mocks.classifyCheckpointRetention,
}));

import {
    applyCheckpointCleanup,
    previewCheckpointCleanup,
} from '@/app/backend/runtime/services/checkpoint/checkpointRetentionService';

describe('checkpointRetentionService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.checkpointStore.listBySession.mockResolvedValue([{ id: 'ckpt_1' }]);
        mocks.checkpointStore.listByProfile.mockResolvedValue([{ id: 'ckpt_1' }]);
        mocks.classifyCheckpointRetention.mockReturnValue({ dispositions: [] });
        mocks.applyRetentionDispositions.mockReturnValue([{ id: 'ckpt_1', retentionDisposition: 'eligible_for_cleanup' }]);
        mocks.checkpointChangesetStore.listChangeCountsByCheckpointIds.mockResolvedValue(new Map([['ckpt_1', 1]]));
        mocks.buildCleanupPreview.mockReturnValue({
            sessionId: 'sess_1',
            retentionPolicy: {
                protectedRecentPerSession: 1,
                protectedRecentPerExecutionTarget: 1,
            },
            milestoneCount: 0,
            protectedRecentCount: 0,
            eligibleCount: 1,
            candidates: [
                {
                    checkpointId: 'ckpt_1',
                    checkpointKind: 'auto',
                    summary: 'Before run',
                    snapshotFileCount: 1,
                    changesetChangeCount: 1,
                    createdAt: '2026-03-27T00:00:00.000Z',
                },
            ],
        });
    });

    it('returns a preview without mutating state', async () => {
        const result = await previewCheckpointCleanup({
            profileId: 'profile_local_default',
            sessionId: 'sess_1',
        });

        expect(result.eligibleCount).toBe(1);
        expect(mocks.checkpointStore.deleteByIds).not.toHaveBeenCalled();
    });

    it('requires confirmation before cleanup mutates storage', async () => {
        const result = await applyCheckpointCleanup({
            profileId: 'profile_local_default',
            sessionId: 'sess_1',
            confirm: false,
        });

        expect(result).toMatchObject({
            cleanedUp: false,
            reason: 'confirmation_required',
            preview: {
                sessionId: 'sess_1',
            },
        });
        expect(mocks.checkpointStore.deleteByIds).not.toHaveBeenCalled();
    });
});
