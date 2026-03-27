import { checkpointChangesetStore, checkpointSnapshotStore, checkpointStore } from '@/app/backend/persistence/stores';
import type { CheckpointRecord } from '@/app/backend/persistence/types';
import type {
    CheckpointCleanupApplyInput,
    CheckpointCleanupApplyResult,
    CheckpointCleanupPreview,
    CheckpointCleanupPreviewInput,
    CheckpointListResult,
} from '@/app/backend/runtime/contracts';
import { compactCheckpointStorage } from '@/app/backend/runtime/services/checkpoint/compaction';
import {
    applyRetentionDispositions,
    buildCleanupPreview,
    classifyCheckpointRetention,
} from '@/app/backend/runtime/services/checkpoint/retention';

export interface CheckpointRetentionState {
    sessionCheckpoints: CheckpointRecord[];
    decoratedCheckpoints: CheckpointListResult['checkpoints'];
    preview: CheckpointCleanupPreview;
}

export async function loadCheckpointRetentionState(input: {
    profileId: string;
    sessionId: CheckpointRecord['sessionId'];
}): Promise<CheckpointRetentionState> {
    const [sessionCheckpoints, profileCheckpoints] = await Promise.all([
        checkpointStore.listBySession(input.profileId, input.sessionId),
        checkpointStore.listByProfile(input.profileId),
    ]);
    const retentionDispositions = classifyCheckpointRetention({
        sessionCheckpoints,
        profileCheckpoints,
    });
    const decoratedCheckpoints = applyRetentionDispositions(sessionCheckpoints, retentionDispositions);
    const changesetCounts = await checkpointChangesetStore.listChangeCountsByCheckpointIds(
        input.profileId,
        sessionCheckpoints.map((checkpoint) => checkpoint.id)
    );

    return {
        sessionCheckpoints,
        decoratedCheckpoints,
        preview: buildCleanupPreview({
            sessionId: input.sessionId,
            checkpoints: sessionCheckpoints,
            retentionDispositions,
            changesetCounts,
        }),
    };
}

export async function previewCheckpointCleanup(
    input: CheckpointCleanupPreviewInput
): Promise<CheckpointCleanupPreview> {
    const retentionState = await loadCheckpointRetentionState(input);
    return retentionState.preview;
}

export async function applyCheckpointCleanup(
    input: CheckpointCleanupApplyInput
): Promise<CheckpointCleanupApplyResult> {
    const retentionState = await loadCheckpointRetentionState(input);
    if (!input.confirm) {
        return {
            cleanedUp: false,
            reason: 'confirmation_required',
            message: 'Checkpoint cleanup requires explicit confirmation.',
            preview: retentionState.preview,
        };
    }

    const deletedCheckpointIds = await checkpointStore.deleteByIds(
        input.profileId,
        retentionState.preview.candidates.map((candidate) => candidate.checkpointId)
    );
    const prunedBlobCount = checkpointSnapshotStore.pruneUnreferencedBlobs();
    await compactCheckpointStorage({
        profileId: input.profileId,
        triggerKind: 'automatic',
        force: false,
    });

    return {
        cleanedUp: true,
        preview: retentionState.preview,
        deletedCheckpointIds,
        deletedCount: deletedCheckpointIds.length,
        prunedBlobCount,
    };
}
