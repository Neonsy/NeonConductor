import { checkpointChangesetStore, checkpointSnapshotStore, checkpointStore } from '@/app/backend/persistence/stores';
import type { CheckpointRevertChangesetInput, CheckpointRevertChangesetResult } from '@/app/backend/runtime/contracts';
import {
    buildSnapshotIndexFromCapture,
    buildSnapshotIndexFromEntries,
    deriveChangesetFromSnapshots,
    evaluateRevertApplicability,
} from '@/app/backend/runtime/services/checkpoint/changeset';
import { buildCheckpointRollbackPreview } from '@/app/backend/runtime/services/checkpoint/checkpointRollbackLifecycle';
import {
    checkpointRecoverySummary,
    createCheckpointRecoverySafetyCheckpoint,
    mapRevertFailureReason,
    resolveCheckpointRecoveryTarget,
    revertSafetyCheckpointSummary,
} from '@/app/backend/runtime/services/checkpoint/checkpointRecoveryShared';
import {
    captureExecutionTargetSnapshot,
    restoreExecutionTargetSnapshot,
} from '@/app/backend/runtime/services/checkpoint/nativeSnapshot';
import { mapChangesetRecord } from '@/app/backend/runtime/services/checkpoint/checkpointPreviewBuilder';

export async function revertCheckpointChangesetLifecycle(
    input: CheckpointRevertChangesetInput
): Promise<CheckpointRevertChangesetResult> {
    const checkpoint = await checkpointStore.getById(input.profileId, input.checkpointId);
    if (!checkpoint) {
        return {
            reverted: false,
            reason: 'not_found',
        };
    }

    const preview = await buildCheckpointRollbackPreview({
        profileId: input.profileId,
        checkpoint,
    });
    if (!input.confirm) {
        return {
            reverted: false,
            reason: 'confirmation_required',
            message: 'Changeset revert requires explicit confirmation.',
            preview,
        };
    }

    if (!preview.changeset) {
        return {
            reverted: false,
            reason: 'changeset_missing',
            message: 'This checkpoint does not have a revertable changeset yet.',
            preview,
        };
    }

    if (!preview.canRevertSafely || preview.revertBlockedReason) {
        return {
            reverted: false,
            reason: mapRevertFailureReason(preview.revertBlockedReason ?? 'target_drifted'),
            message:
                preview.revertBlockedReason === 'changeset_empty'
                    ? 'This checkpoint has no file changes to revert.'
                    : 'Changeset revert is not safe on the current filesystem state.',
            preview,
            changeset: preview.changeset,
        };
    }

    const recoveryTarget = await resolveCheckpointRecoveryTarget({
        profileId: input.profileId,
        checkpoint,
    });
    if (!recoveryTarget) {
        return {
            reverted: false,
            reason: 'workspace_unresolved',
            message: 'Workspace root could not be resolved for this changeset.',
            preview,
            changeset: preview.changeset,
        };
    }

    const safetyCheckpointResult = await createCheckpointRecoverySafetyCheckpoint({
        profileId: input.profileId,
        checkpoint,
        workspaceContext: recoveryTarget.workspaceContext,
        summary: `Safety checkpoint before reverting changes from ${checkpoint.id}`,
    });
    if (safetyCheckpointResult.isErr()) {
        return {
            reverted: false,
            reason:
                safetyCheckpointResult.error.code === 'checkpoint_execution_target_unresolved'
                    ? 'workspace_unresolved'
                    : 'snapshot_invalid',
            message: safetyCheckpointResult.error.message,
            preview,
            changeset: preview.changeset,
        };
    }
    const safetyCheckpoint = safetyCheckpointResult.value;

    const changesetRecord = await checkpointChangesetStore.getByCheckpointId(input.profileId, checkpoint.id);
    if (!changesetRecord) {
        return {
            reverted: false,
            reason: 'changeset_missing',
            message: 'This checkpoint does not have a revertable changeset yet.',
            preview,
            changeset: preview.changeset,
            safetyCheckpoint: revertSafetyCheckpointSummary(safetyCheckpoint),
        };
    }

    const currentSnapshotResult = await captureExecutionTargetSnapshot({
        workspaceRootPath: recoveryTarget.executionTarget.absolutePath,
    });
    if (currentSnapshotResult.isErr()) {
        return {
            reverted: false,
            reason: 'snapshot_invalid',
            message: currentSnapshotResult.error.detail,
            preview,
            changeset: mapChangesetRecord(changesetRecord),
            safetyCheckpoint: revertSafetyCheckpointSummary(safetyCheckpoint),
        };
    }

    const applicability = evaluateRevertApplicability(
        changesetRecord,
        buildSnapshotIndexFromCapture(currentSnapshotResult.value.files)
    );
    if (!applicability.canRevertSafely || !applicability.restoredFiles) {
        return {
            reverted: false,
            reason: mapRevertFailureReason(applicability.reason ?? 'target_drifted'),
            message: 'Changeset revert is not safe on the current filesystem state.',
            preview,
            changeset: mapChangesetRecord(changesetRecord),
            safetyCheckpoint: revertSafetyCheckpointSummary(safetyCheckpoint),
        };
    }

    const restoreResult = await restoreExecutionTargetSnapshot({
        workspaceRootPath: recoveryTarget.executionTarget.absolutePath,
        files: applicability.restoredFiles,
    });
    if (restoreResult.isErr()) {
        return {
            reverted: false,
            reason: 'revert_failed',
            message: restoreResult.error.detail,
            preview,
            changeset: mapChangesetRecord(changesetRecord),
            safetyCheckpoint: revertSafetyCheckpointSummary(safetyCheckpoint),
        };
    }

    const safetySnapshotEntries = await checkpointSnapshotStore.listSnapshotEntries(safetyCheckpoint.id);
    const revertChangeset = await checkpointChangesetStore.replaceForCheckpoint({
        profileId: input.profileId,
        checkpointId: safetyCheckpoint.id,
        sourceChangesetId: changesetRecord.id,
        sessionId: safetyCheckpoint.sessionId,
        threadId: safetyCheckpoint.threadId,
        executionTargetKey: safetyCheckpoint.executionTargetKey,
        executionTargetKind: safetyCheckpoint.executionTargetKind,
        executionTargetLabel: safetyCheckpoint.executionTargetLabel,
        createdByKind: 'system',
        changesetKind: 'revert',
        summary: `Reverted ${changesetRecord.summary.toLowerCase()}`,
        entries: deriveChangesetFromSnapshots({
            beforeFiles: buildSnapshotIndexFromEntries(safetySnapshotEntries),
            afterFiles: buildSnapshotIndexFromCapture(applicability.restoredFiles),
        }).entries,
    });

    return {
        reverted: true,
        checkpoint: checkpointRecoverySummary(checkpoint),
        preview,
        changeset: mapChangesetRecord(changesetRecord),
        safetyCheckpoint: revertSafetyCheckpointSummary(safetyCheckpoint),
        revertChangeset: mapChangesetRecord(revertChangeset),
    };
}
