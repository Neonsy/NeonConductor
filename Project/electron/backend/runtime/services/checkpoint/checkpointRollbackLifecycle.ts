import { checkpointChangesetStore, checkpointSnapshotStore, checkpointStore } from '@/app/backend/persistence/stores';
import type { CheckpointChangesetRecord, CheckpointRecord } from '@/app/backend/persistence/types';
import type {
    CheckpointRollbackInput,
    CheckpointRollbackPreview,
    CheckpointRollbackPreviewInput,
    CheckpointRollbackResult,
} from '@/app/backend/runtime/contracts';
import { buildSnapshotIndexFromCapture, evaluateRevertApplicability } from '@/app/backend/runtime/services/checkpoint/changeset';
import { listAffectedSessionsForExecutionTarget } from '@/app/backend/runtime/services/checkpoint/executionTarget';
import {
    checkpointRecoverySummary,
    createCheckpointRecoverySafetyCheckpoint,
    mapRestoreFailureReason,
    resolveCheckpointRecoveryTarget,
    rollbackSafetyCheckpointSummary,
} from '@/app/backend/runtime/services/checkpoint/checkpointRecoveryShared';
import {
    captureExecutionTargetSnapshot,
    restoreExecutionTargetSnapshot,
} from '@/app/backend/runtime/services/checkpoint/nativeSnapshot';
import { mapChangesetRecord } from '@/app/backend/runtime/services/checkpoint/checkpointPreviewBuilder';

async function assessCheckpointRevertAction(input: {
    profileId: string;
    checkpoint: CheckpointRecord;
}): Promise<{
    changeset: CheckpointChangesetRecord | null;
    canRevertSafely: boolean;
    revertBlockedReason?: CheckpointRollbackPreview['revertBlockedReason'];
}> {
    const changeset = await checkpointChangesetStore.getByCheckpointId(input.profileId, input.checkpoint.id);
    if (!changeset) {
        return {
            changeset: null,
            canRevertSafely: false,
            revertBlockedReason: 'changeset_missing',
        };
    }

    const recoveryTarget = await resolveCheckpointRecoveryTarget({
        profileId: input.profileId,
        checkpoint: input.checkpoint,
    });
    if (!recoveryTarget) {
        return {
            changeset,
            canRevertSafely: false,
            revertBlockedReason: 'workspace_unresolved',
        };
    }

    const currentSnapshotResult = await captureExecutionTargetSnapshot({
        workspaceRootPath: recoveryTarget.executionTarget.absolutePath,
    });
    if (currentSnapshotResult.isErr()) {
        return {
            changeset,
            canRevertSafely: false,
            revertBlockedReason: 'snapshot_invalid',
        };
    }

    const applicability = evaluateRevertApplicability(
        changeset,
        buildSnapshotIndexFromCapture(currentSnapshotResult.value.files)
    );
    return {
        changeset,
        canRevertSafely: applicability.canRevertSafely,
        ...(applicability.reason ? { revertBlockedReason: applicability.reason } : {}),
    };
}

export async function buildCheckpointRollbackPreview(input: {
    profileId: string;
    checkpoint: CheckpointRecord;
}): Promise<CheckpointRollbackPreview> {
    const [affectedSessions, targetCheckpoints, revertAssessment] = await Promise.all([
        listAffectedSessionsForExecutionTarget({
            profileId: input.profileId,
            executionTargetKey: input.checkpoint.executionTargetKey,
        }),
        checkpointStore.listByExecutionTargetKey(input.profileId, input.checkpoint.executionTargetKey),
        assessCheckpointRevertAction({
            profileId: input.profileId,
            checkpoint: input.checkpoint,
        }),
    ]);

    const isSharedTarget = affectedSessions.some((session) => session.sessionId !== input.checkpoint.sessionId);
    const hasLaterForeignChanges = targetCheckpoints.some(
        (candidate) =>
            candidate.id !== input.checkpoint.id &&
            candidate.sessionId !== input.checkpoint.sessionId &&
            candidate.createdAt > input.checkpoint.createdAt
    );
    const highRisk = isSharedTarget || hasLaterForeignChanges;
    const recommendedAction =
        highRisk && revertAssessment.changeset && revertAssessment.canRevertSafely
            ? 'revert_changeset'
            : 'restore_checkpoint';

    return {
        checkpointId: input.checkpoint.id,
        executionTargetKey: input.checkpoint.executionTargetKey,
        executionTargetKind: input.checkpoint.executionTargetKind,
        executionTargetLabel: input.checkpoint.executionTargetLabel,
        isSharedTarget,
        hasLaterForeignChanges,
        isHighRisk: highRisk,
        affectedSessions,
        hasChangeset: Boolean(revertAssessment.changeset),
        ...(revertAssessment.changeset ? { changeset: mapChangesetRecord(revertAssessment.changeset) } : {}),
        recommendedAction,
        canRevertSafely: revertAssessment.canRevertSafely,
        ...(revertAssessment.revertBlockedReason ? { revertBlockedReason: revertAssessment.revertBlockedReason } : {}),
    };
}

export async function getCheckpointRollbackPreview(
    input: CheckpointRollbackPreviewInput
): Promise<{ found: false } | { found: true; preview: CheckpointRollbackPreview }> {
    const checkpoint = await checkpointStore.getById(input.profileId, input.checkpointId);
    if (!checkpoint) {
        return {
            found: false,
        };
    }

    return {
        found: true,
        preview: await buildCheckpointRollbackPreview({
            profileId: input.profileId,
            checkpoint,
        }),
    };
}

export async function rollbackCheckpointLifecycle(input: CheckpointRollbackInput): Promise<CheckpointRollbackResult> {
    const checkpoint = await checkpointStore.getById(input.profileId, input.checkpointId);
    if (!checkpoint) {
        return {
            rolledBack: false,
            reason: 'not_found',
        };
    }

    const preview = await buildCheckpointRollbackPreview({
        profileId: input.profileId,
        checkpoint,
    });
    if (!input.confirm) {
        return {
            rolledBack: false,
            reason: 'confirmation_required',
            message: 'Checkpoint rollback requires explicit confirmation.',
            preview,
        };
    }

    const recoveryTarget = await resolveCheckpointRecoveryTarget({
        profileId: input.profileId,
        checkpoint,
    });
    if (!recoveryTarget) {
        return {
            rolledBack: false,
            reason: 'workspace_unresolved',
            message: 'Workspace root could not be resolved for this checkpoint.',
            preview,
        };
    }

    const safetyCheckpointResult = await createCheckpointRecoverySafetyCheckpoint({
        profileId: input.profileId,
        checkpoint,
        workspaceContext: recoveryTarget.workspaceContext,
        summary: `Safety checkpoint before restoring ${checkpoint.id}`,
    });
    if (safetyCheckpointResult.isErr()) {
        return {
            rolledBack: false,
            reason:
                safetyCheckpointResult.error.code === 'checkpoint_execution_target_unresolved'
                    ? 'workspace_unresolved'
                    : 'snapshot_invalid',
            message: safetyCheckpointResult.error.message,
            preview,
        };
    }
    const safetyCheckpoint = safetyCheckpointResult.value;

    const snapshotEntries = await checkpointSnapshotStore.listSnapshotEntries(checkpoint.id);
    if (snapshotEntries.length === 0 && checkpoint.snapshotFileCount > 0) {
        return {
            rolledBack: false,
            reason: 'snapshot_invalid',
            message: 'Checkpoint snapshot data is missing.',
            preview,
            safetyCheckpoint: rollbackSafetyCheckpointSummary(safetyCheckpoint),
        };
    }

    const restoreResult = await restoreExecutionTargetSnapshot({
        workspaceRootPath: recoveryTarget.executionTarget.absolutePath,
        files: snapshotEntries.map((entry) => ({
            relativePath: entry.relativePath,
            bytes: entry.bytes,
        })),
    });
    if (restoreResult.isErr()) {
        return {
            rolledBack: false,
            reason: mapRestoreFailureReason(restoreResult.error.reason),
            message: restoreResult.error.detail,
            preview,
            safetyCheckpoint: rollbackSafetyCheckpointSummary(safetyCheckpoint),
        };
    }

    return {
        rolledBack: true,
        checkpoint: checkpointRecoverySummary(checkpoint),
        preview,
        safetyCheckpoint: rollbackSafetyCheckpointSummary(safetyCheckpoint),
    };
}
