import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    compactCheckpointStorage: vi.fn(),
    getCheckpointStorageSummary: vi.fn(),
}));

vi.mock('@/app/backend/runtime/services/checkpoint/compaction', () => ({
    compactCheckpointStorage: mocks.compactCheckpointStorage,
    getCheckpointStorageSummary: mocks.getCheckpointStorageSummary,
}));

import { forceCompactCheckpointStorage } from '@/app/backend/runtime/services/checkpoint/checkpointStorageMaintenanceService';

describe('checkpointStorageMaintenanceService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns confirmation_required with storage summary when confirm is false', async () => {
        mocks.getCheckpointStorageSummary.mockResolvedValue({
            profileId: 'profile_local_default',
            looseReferencedBlobCount: 1,
            looseReferencedByteSize: 10,
            packedReferencedBlobCount: 2,
            packedReferencedByteSize: 20,
            totalReferencedBlobCount: 3,
            totalReferencedByteSize: 30,
            lastCompactionRun: null,
        });

        const result = await forceCompactCheckpointStorage({
            profileId: 'profile_local_default',
            sessionId: 'sess_1',
            confirm: false,
        });

        expect(result).toEqual({
            compacted: false,
            reason: 'confirmation_required',
            message: 'Checkpoint compaction requires explicit confirmation.',
            storage: {
                looseReferencedBlobCount: 1,
                looseReferencedByteSize: 10,
                packedReferencedBlobCount: 2,
                packedReferencedByteSize: 20,
                totalReferencedBlobCount: 3,
                totalReferencedByteSize: 30,
            },
        });
    });

    it('returns run and storage projections after manual compaction', async () => {
        mocks.compactCheckpointStorage.mockResolvedValue({
            run: {
                id: 'cpr_1',
                triggerKind: 'manual',
                status: 'success',
                blobCountBefore: 4,
                blobCountAfter: 2,
                bytesBefore: 40,
                bytesAfter: 20,
                blobsCompacted: 2,
                databaseReclaimed: true,
                startedAt: '2026-03-27T00:00:00.000Z',
                completedAt: '2026-03-27T00:00:01.000Z',
            },
            storage: {
                profileId: 'profile_local_default',
                looseReferencedBlobCount: 1,
                looseReferencedByteSize: 10,
                packedReferencedBlobCount: 2,
                packedReferencedByteSize: 20,
                totalReferencedBlobCount: 3,
                totalReferencedByteSize: 30,
                lastCompactionRun: {
                    id: 'cpr_1',
                    triggerKind: 'manual',
                    status: 'success',
                    blobCountBefore: 4,
                    blobCountAfter: 2,
                    bytesBefore: 40,
                    bytesAfter: 20,
                    blobsCompacted: 2,
                    databaseReclaimed: true,
                    startedAt: '2026-03-27T00:00:00.000Z',
                    completedAt: '2026-03-27T00:00:01.000Z',
                },
            },
        });

        const result = await forceCompactCheckpointStorage({
            profileId: 'profile_local_default',
            sessionId: 'sess_1',
            confirm: true,
        });

        expect(result).toMatchObject({
            compacted: true,
            run: { id: 'cpr_1', status: 'success' },
            storage: { totalReferencedBlobCount: 3 },
        });
    });
});
