import type { CheckpointRecord } from '@/app/backend/persistence/types';
import type {
    CheckpointRevertChangesetResult,
    CheckpointRollbackPreview,
    CheckpointRollbackResult,
    ResolvedWorkspaceContext,
} from '@/app/backend/runtime/contracts';
import { resolveCheckpointExecutionTarget } from '@/app/backend/runtime/services/checkpoint/executionTarget';
import { createNativeCheckpointForResolvedTarget } from '@/app/backend/runtime/services/checkpoint/checkpointCaptureLifecycle';
import { workspaceContextService } from '@/app/backend/runtime/services/workspaceContext/service';

type CheckpointExecutionTarget = NonNullable<ReturnType<typeof resolveCheckpointExecutionTarget>>;
type CheckpointSummary = NonNullable<CheckpointRollbackResult['checkpoint']>;
type RollbackSafetyCheckpointSummary = NonNullable<CheckpointRollbackResult['safetyCheckpoint']>;
type RevertSafetyCheckpointSummary = NonNullable<CheckpointRevertChangesetResult['safetyCheckpoint']>;

export function checkpointRecoverySummary(record: CheckpointRecord): CheckpointSummary {
    return {
        id: record.id,
        sessionId: record.sessionId,
        threadId: record.threadId,
        ...(record.runId ? { runId: record.runId } : {}),
        topLevelTab: record.topLevelTab,
        modeKey: record.modeKey,
    };
}

export function rollbackSafetyCheckpointSummary(record: CheckpointRecord): RollbackSafetyCheckpointSummary {
    return checkpointRecoverySummary(record);
}

export function revertSafetyCheckpointSummary(record: CheckpointRecord): RevertSafetyCheckpointSummary {
    return checkpointRecoverySummary(record);
}

export function mapRestoreFailureReason(
    reason: 'snapshot_invalid' | 'restore_failed'
): Extract<CheckpointRollbackResult['reason'], 'snapshot_invalid' | 'restore_failed'> {
    return reason;
}

export function mapRevertFailureReason(
    reason: CheckpointRollbackPreview['revertBlockedReason']
): Extract<
    CheckpointRevertChangesetResult['reason'],
    'changeset_missing' | 'changeset_empty' | 'workspace_unresolved' | 'snapshot_invalid' | 'target_drifted'
> {
    if (
        reason === 'changeset_missing' ||
        reason === 'changeset_empty' ||
        reason === 'workspace_unresolved' ||
        reason === 'snapshot_invalid'
    ) {
        return reason;
    }

    return 'target_drifted';
}

export async function resolveCheckpointRecoveryTarget(input: {
    profileId: string;
    checkpoint: Pick<CheckpointRecord, 'workspaceFingerprint' | 'sandboxId' | 'executionTargetKey'>;
}): Promise<{
    workspaceContext: ResolvedWorkspaceContext;
    executionTarget: CheckpointExecutionTarget;
} | null> {
    const workspaceContext = await workspaceContextService.resolveExplicit({
        profileId: input.profileId,
        workspaceFingerprint: input.checkpoint.workspaceFingerprint,
        ...(input.checkpoint.sandboxId ? { sandboxId: input.checkpoint.sandboxId } : {}),
    });
    const executionTarget = resolveCheckpointExecutionTarget(workspaceContext);
    if (!executionTarget || executionTarget.executionTargetKey !== input.checkpoint.executionTargetKey) {
        return null;
    }

    return {
        workspaceContext,
        executionTarget,
    };
}

export async function createCheckpointRecoverySafetyCheckpoint(input: {
    profileId: string;
    checkpoint: Pick<CheckpointRecord, 'sessionId' | 'threadId' | 'topLevelTab' | 'modeKey'>;
    workspaceContext: ResolvedWorkspaceContext;
    summary: string;
}) {
    return createNativeCheckpointForResolvedTarget({
        profileId: input.profileId,
        sessionId: input.checkpoint.sessionId,
        threadId: input.checkpoint.threadId,
        topLevelTab: input.checkpoint.topLevelTab,
        modeKey: input.checkpoint.modeKey,
        workspaceContext: input.workspaceContext,
        createdByKind: 'system',
        checkpointKind: 'safety',
        summary: input.summary,
    });
}
