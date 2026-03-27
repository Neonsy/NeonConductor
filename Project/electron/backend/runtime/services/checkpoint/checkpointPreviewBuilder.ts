import type {
    CheckpointChangesetRecord,
    CheckpointCompactionRunRecord,
    CheckpointRecord,
    CheckpointStorageSummary as PersistenceCheckpointStorageSummary,
} from '@/app/backend/persistence/types';
import type {
    ChangesetRecord,
    CheckpointCompactionRunSummary,
    CheckpointListResult,
    CheckpointRevertChangesetResult,
    CheckpointRollbackResult,
    CheckpointStorageSummary,
} from '@/app/backend/runtime/contracts';
import { getCheckpointStorageSummary } from '@/app/backend/runtime/services/checkpoint/compaction';
import { loadCheckpointRetentionState } from '@/app/backend/runtime/services/checkpoint/checkpointRetentionService';

type CheckpointSummary = NonNullable<CheckpointRollbackResult['checkpoint']>;
type SafetyCheckpointSummary = NonNullable<CheckpointRollbackResult['safetyCheckpoint']>;
type RevertSafetyCheckpointSummary = NonNullable<CheckpointRevertChangesetResult['safetyCheckpoint']>;

export function mapCompactionRunSummary(run: CheckpointCompactionRunRecord): CheckpointCompactionRunSummary {
    return {
        id: run.id,
        triggerKind: run.triggerKind,
        status: run.status,
        ...(run.message ? { message: run.message } : {}),
        blobCountBefore: run.blobCountBefore,
        blobCountAfter: run.blobCountAfter,
        bytesBefore: run.bytesBefore,
        bytesAfter: run.bytesAfter,
        blobsCompacted: run.blobsCompacted,
        databaseReclaimed: run.databaseReclaimed,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
    };
}

export function buildCheckpointStorageProjection(
    storage: PersistenceCheckpointStorageSummary
): CheckpointStorageSummary {
    return {
        looseReferencedBlobCount: storage.looseReferencedBlobCount,
        looseReferencedByteSize: storage.looseReferencedByteSize,
        packedReferencedBlobCount: storage.packedReferencedBlobCount,
        packedReferencedByteSize: storage.packedReferencedByteSize,
        totalReferencedBlobCount: storage.totalReferencedBlobCount,
        totalReferencedByteSize: storage.totalReferencedByteSize,
        ...(storage.lastCompactionRun ? { lastCompactionRun: mapCompactionRunSummary(storage.lastCompactionRun) } : {}),
    };
}

export function mapChangesetRecord(record: CheckpointChangesetRecord): ChangesetRecord {
    return {
        id: record.id,
        checkpointId: record.checkpointId,
        ...(record.sourceChangesetId ? { sourceChangesetId: record.sourceChangesetId } : {}),
        sessionId: record.sessionId,
        threadId: record.threadId,
        ...(record.runId ? { runId: record.runId } : {}),
        executionTargetKey: record.executionTargetKey,
        executionTargetKind: record.executionTargetKind,
        executionTargetLabel: record.executionTargetLabel,
        changesetKind: record.changesetKind,
        changeCount: record.changeCount,
        summary: record.summary,
    };
}

export async function buildCheckpointListResult(input: {
    profileId: string;
    sessionId: CheckpointRecord['sessionId'];
}): Promise<CheckpointListResult> {
    const [retentionState, storage] = await Promise.all([
        loadCheckpointRetentionState(input),
        getCheckpointStorageSummary(input.profileId),
    ]);

    return {
        checkpoints: retentionState.decoratedCheckpoints,
        storage: buildCheckpointStorageProjection(storage),
    };
}

export function checkpointSummary(record: CheckpointRecord): CheckpointSummary {
    return {
        id: record.id,
        sessionId: record.sessionId,
        threadId: record.threadId,
        ...(record.runId ? { runId: record.runId } : {}),
        topLevelTab: record.topLevelTab,
        modeKey: record.modeKey,
    };
}

export function rollbackSafetyCheckpointSummary(record: CheckpointRecord): SafetyCheckpointSummary {
    return checkpointSummary(record);
}

export function revertSafetyCheckpointSummary(record: CheckpointRecord): RevertSafetyCheckpointSummary {
    return checkpointSummary(record);
}
