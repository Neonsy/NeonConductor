import {
    checkpointSnapshotStore,
    checkpointStore,
} from '@/app/backend/persistence/stores';
import type { CheckpointChangesetRecord, CheckpointRecord, DiffRecord } from '@/app/backend/persistence/types';
import type {
    CheckpointCleanupApplyInput,
    CheckpointCleanupApplyResult,
    CheckpointCleanupPreview,
    CheckpointCleanupPreviewInput,
    CheckpointCreateInput,
    CheckpointDeleteMilestoneInput,
    CheckpointForceCompactInput,
    CheckpointForceCompactResult,
    CheckpointListResult,
    CheckpointPromoteMilestoneInput,
    CheckpointRevertChangesetInput,
    CheckpointRevertChangesetResult,
    CheckpointRenameMilestoneInput,
    CheckpointRollbackInput,
    CheckpointRollbackPreview,
    CheckpointRollbackPreviewInput,
    CheckpointRollbackResult,
    ResolvedWorkspaceContext,
} from '@/app/backend/runtime/contracts';
import {
    applyCheckpointCleanup as applyCheckpointCleanupFromRetentionService,
    previewCheckpointCleanup as previewCheckpointCleanupFromRetentionService,
} from '@/app/backend/runtime/services/checkpoint/checkpointRetentionService';
import {
    buildCheckpointListResult,
    checkpointSummary,
} from '@/app/backend/runtime/services/checkpoint/checkpointPreviewBuilder';
import { forceCompactCheckpointStorage as forceCompactCheckpointStorageFromMaintenanceService } from '@/app/backend/runtime/services/checkpoint/checkpointStorageMaintenanceService';
import { captureCheckpointDiffForRunLifecycle } from '@/app/backend/runtime/services/checkpoint/checkpointArtifactCaptureLifecycle';
import {
    createCheckpointLifecycle,
    ensureCheckpointForRunLifecycle,
} from '@/app/backend/runtime/services/checkpoint/checkpointCaptureLifecycle';
import {
    getCheckpointRollbackPreview,
    rollbackCheckpointLifecycle,
} from '@/app/backend/runtime/services/checkpoint/checkpointRollbackLifecycle';
import { revertCheckpointChangesetLifecycle } from '@/app/backend/runtime/services/checkpoint/checkpointRevertLifecycle';
import { type OperationalResult } from '@/app/backend/runtime/services/common/operationalError';

type CheckpointCreateResult = {
    created: boolean;
    reason?: 'not_found' | 'unsupported_run';
    diff?: DiffRecord;
    checkpoint?: CheckpointRecord;
};
type CheckpointSummary = NonNullable<CheckpointRollbackResult['checkpoint']>;

export async function ensureCheckpointForRun(input: {
    profileId: string;
    runId: NonNullable<CheckpointRecord['runId']>;
    sessionId: CheckpointRecord['sessionId'];
    threadId: CheckpointRecord['threadId'];
    topLevelTab: CheckpointRecord['topLevelTab'];
    modeKey: string;
    workspaceContext: ResolvedWorkspaceContext;
}): Promise<OperationalResult<CheckpointRecord | null>> {
    return ensureCheckpointForRunLifecycle(input);
}

export async function listCheckpoints(input: {
    profileId: string;
    sessionId: CheckpointRecord['sessionId'];
}): Promise<CheckpointListResult> {
    return buildCheckpointListResult(input);
}

export async function createCheckpoint(input: CheckpointCreateInput): Promise<CheckpointCreateResult> {
    return createCheckpointLifecycle(input);
}

export async function promoteCheckpointToMilestone(input: CheckpointPromoteMilestoneInput): Promise<{
    promoted: boolean;
    reason?: 'not_found';
    checkpoint?: CheckpointRecord;
}> {
    const checkpoint = await checkpointStore.updateMilestone(input);
    if (!checkpoint) {
        return {
            promoted: false,
            reason: 'not_found',
        };
    }

    return {
        promoted: true,
        checkpoint,
    };
}

export async function renameCheckpointMilestone(input: CheckpointRenameMilestoneInput): Promise<{
    renamed: boolean;
    reason?: 'not_found';
    checkpoint?: CheckpointRecord;
}> {
    const checkpoint = await checkpointStore.renameMilestone(input);
    if (!checkpoint) {
        return {
            renamed: false,
            reason: 'not_found',
        };
    }

    return {
        renamed: true,
        checkpoint,
    };
}

export async function deleteCheckpointMilestone(input: CheckpointDeleteMilestoneInput): Promise<{
    deleted: boolean;
    reason?: 'confirmation_required' | 'not_found' | 'not_milestone';
    prunedBlobCount?: number;
    checkpoint?: CheckpointSummary;
}> {
    const checkpoint = await checkpointStore.getById(input.profileId, input.checkpointId);
    if (!checkpoint) {
        return {
            deleted: false,
            reason: 'not_found',
        };
    }

    if (checkpoint.checkpointKind !== 'named') {
        return {
            deleted: false,
            reason: 'not_milestone',
        };
    }

    if (!input.confirm) {
        return {
            deleted: false,
            reason: 'confirmation_required',
        };
    }

    const deleted = await checkpointStore.deleteById(input.profileId, input.checkpointId);
    const prunedBlobCount = deleted ? checkpointSnapshotStore.pruneUnreferencedBlobs() : 0;

    return {
        deleted,
        ...(deleted ? { checkpoint: checkpointSummary(checkpoint) } : {}),
        ...(deleted ? { prunedBlobCount } : {}),
    };
}

export async function previewCheckpointCleanup(
    input: CheckpointCleanupPreviewInput
): Promise<CheckpointCleanupPreview> {
    return previewCheckpointCleanupFromRetentionService(input);
}

export async function applyCheckpointCleanup(
    input: CheckpointCleanupApplyInput
): Promise<CheckpointCleanupApplyResult> {
    return applyCheckpointCleanupFromRetentionService(input);
}

export async function forceCompactCheckpointStorage(
    input: CheckpointForceCompactInput
): Promise<CheckpointForceCompactResult> {
    return forceCompactCheckpointStorageFromMaintenanceService(input);
}

export async function captureCheckpointDiffForRun(input: {
    profileId: string;
    sessionId: CheckpointRecord['sessionId'];
    runId: NonNullable<CheckpointRecord['runId']>;
    topLevelTab: CheckpointRecord['topLevelTab'];
    modeKey: string;
    workspaceContext: ResolvedWorkspaceContext;
}): Promise<{
    diff?: DiffRecord;
    checkpoint?: CheckpointRecord;
    changeset?: CheckpointChangesetRecord;
} | null> {
    return captureCheckpointDiffForRunLifecycle(input);
}

export async function getRollbackPreview(
    input: CheckpointRollbackPreviewInput
): Promise<{ found: false } | { found: true; preview: CheckpointRollbackPreview }> {
    return getCheckpointRollbackPreview(input);
}

export async function rollbackCheckpoint(input: CheckpointRollbackInput): Promise<CheckpointRollbackResult> {
    return rollbackCheckpointLifecycle(input);
}

export async function revertCheckpointChangeset(
    input: CheckpointRevertChangesetInput
): Promise<CheckpointRevertChangesetResult> {
    return revertCheckpointChangesetLifecycle(input);
}
