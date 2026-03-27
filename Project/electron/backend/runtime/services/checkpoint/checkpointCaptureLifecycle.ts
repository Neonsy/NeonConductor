import {
    checkpointSnapshotStore,
    checkpointStore,
    runStore,
    threadStore,
} from '@/app/backend/persistence/stores';
import type { CheckpointRecord, DiffRecord } from '@/app/backend/persistence/types';
import type { CheckpointCreateInput, ResolvedWorkspaceContext } from '@/app/backend/runtime/contracts';
import { isEntityId } from '@/app/backend/runtime/contracts';
import { compactCheckpointStorage } from '@/app/backend/runtime/services/checkpoint/compaction';
import { resolveCheckpointExecutionTarget } from '@/app/backend/runtime/services/checkpoint/executionTarget';
import { captureRunDiffArtifact, isMutatingCheckpointMode } from '@/app/backend/runtime/services/checkpoint/checkpointArtifactCaptureLifecycle';
import { captureExecutionTargetSnapshot } from '@/app/backend/runtime/services/checkpoint/nativeSnapshot';
import { errOp, okOp, type OperationalResult } from '@/app/backend/runtime/services/common/operationalError';
import { workspaceContextService } from '@/app/backend/runtime/services/workspaceContext/service';

type CheckpointCreateResult = {
    created: boolean;
    reason?: 'not_found' | 'unsupported_run';
    diff?: DiffRecord;
    checkpoint?: CheckpointRecord;
};

function summarizeCheckpoint(input: {
    checkpointKind: CheckpointRecord['checkpointKind'];
    topLevelTab: CheckpointRecord['topLevelTab'];
    modeKey: string;
    executionTargetLabel: string;
    runId?: CheckpointRecord['runId'];
}): string {
    if (input.checkpointKind === 'safety') {
        return `Safety checkpoint for ${input.executionTargetLabel}`;
    }

    if (input.checkpointKind === 'named') {
        return input.runId
            ? `Manual checkpoint before ${input.topLevelTab}.${input.modeKey} run ${input.runId}`
            : `Manual checkpoint for ${input.executionTargetLabel}`;
    }

    return input.runId
        ? `Before ${input.topLevelTab}.${input.modeKey} run ${input.runId}`
        : `Automatic checkpoint for ${input.executionTargetLabel}`;
}

export async function createNativeCheckpointForResolvedTarget(input: {
    profileId: string;
    sessionId: CheckpointRecord['sessionId'];
    threadId: CheckpointRecord['threadId'];
    runId?: CheckpointRecord['runId'];
    topLevelTab: CheckpointRecord['topLevelTab'];
    modeKey: string;
    workspaceContext: ResolvedWorkspaceContext;
    createdByKind: CheckpointRecord['createdByKind'];
    checkpointKind: CheckpointRecord['checkpointKind'];
    milestoneTitle?: string;
    summary?: string;
}): Promise<OperationalResult<CheckpointRecord>> {
    if (input.runId) {
        const existing = await checkpointStore.getByRunId(input.profileId, input.runId);
        if (existing) {
            return okOp(existing);
        }
    }

    const executionTarget = resolveCheckpointExecutionTarget(input.workspaceContext);
    if (!executionTarget) {
        return errOp(
            'checkpoint_execution_target_unresolved',
            'Workspace execution target could not be resolved for checkpoint capture.'
        );
    }

    const snapshotResult = await captureExecutionTargetSnapshot({
        workspaceRootPath: executionTarget.absolutePath,
    });
    if (snapshotResult.isErr()) {
        return errOp('checkpoint_snapshot_capture_failed', snapshotResult.error.detail);
    }

    const checkpoint = await checkpointStore.create({
        profileId: input.profileId,
        sessionId: input.sessionId,
        threadId: input.threadId,
        ...(input.runId ? { runId: input.runId } : {}),
        workspaceFingerprint: executionTarget.workspaceFingerprint,
        ...(executionTarget.sandboxId ? { sandboxId: executionTarget.sandboxId } : {}),
        executionTargetKey: executionTarget.executionTargetKey,
        executionTargetKind: executionTarget.executionTargetKind,
        executionTargetLabel: executionTarget.executionTargetLabel,
        createdByKind: input.createdByKind,
        checkpointKind: input.checkpointKind,
        ...(input.milestoneTitle ? { milestoneTitle: input.milestoneTitle } : {}),
        snapshotFileCount: snapshotResult.value.fileCount,
        topLevelTab: input.topLevelTab,
        modeKey: input.modeKey,
        summary:
            input.summary ??
            summarizeCheckpoint({
                checkpointKind: input.checkpointKind,
                topLevelTab: input.topLevelTab,
                modeKey: input.modeKey,
                executionTargetLabel: executionTarget.executionTargetLabel,
                ...(input.runId ? { runId: input.runId } : {}),
            }),
    });

    try {
        await checkpointSnapshotStore.replaceSnapshot({
            checkpointId: checkpoint.id,
            files: snapshotResult.value.files,
        });
        await compactCheckpointStorage({
            profileId: input.profileId,
            triggerKind: 'automatic',
            force: false,
        });
        return okOp(checkpoint);
    } catch (error) {
        await checkpointStore.deleteById(input.profileId, checkpoint.id);
        return errOp(
            'checkpoint_snapshot_capture_failed',
            error instanceof Error ? error.message : 'Checkpoint snapshot capture could not be finalized.'
        );
    }
}

export async function ensureCheckpointForRunLifecycle(input: {
    profileId: string;
    runId: NonNullable<CheckpointRecord['runId']>;
    sessionId: CheckpointRecord['sessionId'];
    threadId: CheckpointRecord['threadId'];
    topLevelTab: CheckpointRecord['topLevelTab'];
    modeKey: string;
    workspaceContext: ResolvedWorkspaceContext;
}): Promise<OperationalResult<CheckpointRecord | null>> {
    if (!isMutatingCheckpointMode(input.topLevelTab, input.modeKey)) {
        return okOp(null);
    }

    if (!resolveCheckpointExecutionTarget(input.workspaceContext)) {
        return errOp(
            'checkpoint_execution_target_unresolved',
            'Mutating run checkpoint capture requires a resolved execution target.'
        );
    }

    return createNativeCheckpointForResolvedTarget({
        profileId: input.profileId,
        sessionId: input.sessionId,
        threadId: input.threadId,
        runId: input.runId,
        topLevelTab: input.topLevelTab,
        modeKey: input.modeKey,
        workspaceContext: input.workspaceContext,
        createdByKind: 'system',
        checkpointKind: 'auto',
    });
}

export async function createCheckpointLifecycle(input: CheckpointCreateInput): Promise<CheckpointCreateResult> {
    const run = await runStore.getById(input.runId);
    if (!run || run.profileId !== input.profileId) {
        return {
            created: false,
            reason: 'not_found',
        };
    }

    const sessionThread = await threadStore.getBySessionId(input.profileId, run.sessionId);
    if (!sessionThread) {
        return {
            created: false,
            reason: 'not_found',
        };
    }

    const modeKey =
        sessionThread.thread.topLevelTab === 'agent'
            ? 'code'
            : sessionThread.thread.topLevelTab === 'orchestrator'
              ? 'orchestrate'
              : '';
    if (!modeKey || !isMutatingCheckpointMode(sessionThread.thread.topLevelTab, modeKey)) {
        return {
            created: false,
            reason: 'unsupported_run',
        };
    }

    const existingCheckpoint = await checkpointStore.getByRunId(input.profileId, run.id);
    if (existingCheckpoint) {
        const workspaceContext = await workspaceContextService.resolveForSession({
            profileId: input.profileId,
            sessionId: run.sessionId,
            allowLazySandboxCreation: false,
        });
        const checkpoint =
            existingCheckpoint.checkpointKind === 'named'
                ? await checkpointStore.renameMilestone({
                      profileId: input.profileId,
                      checkpointId: existingCheckpoint.id,
                      milestoneTitle: input.milestoneTitle,
                  })
                : await checkpointStore.updateMilestone({
                      profileId: input.profileId,
                      checkpointId: existingCheckpoint.id,
                      milestoneTitle: input.milestoneTitle,
                  });
        const diffResult = await captureRunDiffArtifact({
            profileId: input.profileId,
            sessionId: run.sessionId,
            runId: run.id,
            topLevelTab: sessionThread.thread.topLevelTab,
            modeKey,
            workspaceContext: workspaceContext ?? { kind: 'detached' },
        });

        return {
            created: Boolean(checkpoint),
            ...(diffResult?.diff ? { diff: diffResult.diff } : {}),
            checkpoint: checkpoint ?? diffResult?.checkpoint ?? existingCheckpoint,
        };
    }

    const workspaceContext = await workspaceContextService.resolveForSession({
        profileId: input.profileId,
        sessionId: run.sessionId,
        allowLazySandboxCreation: false,
    });
    if (!workspaceContext || !resolveCheckpointExecutionTarget(workspaceContext)) {
        return {
            created: false,
            reason: 'unsupported_run',
        };
    }
    if (!isEntityId(sessionThread.thread.id, 'thr')) {
        return {
            created: false,
            reason: 'not_found',
        };
    }

    const checkpointResult = await createNativeCheckpointForResolvedTarget({
        profileId: input.profileId,
        sessionId: run.sessionId,
        threadId: sessionThread.thread.id,
        runId: run.id,
        topLevelTab: sessionThread.thread.topLevelTab,
        modeKey,
        workspaceContext,
        createdByKind: 'user',
        checkpointKind: 'named',
        milestoneTitle: input.milestoneTitle,
        summary: input.milestoneTitle,
    });
    if (checkpointResult.isErr()) {
        return {
            created: false,
        };
    }
    const checkpoint = checkpointResult.value;

    const diffResult = await captureRunDiffArtifact({
        profileId: input.profileId,
        sessionId: run.sessionId,
        runId: run.id,
        topLevelTab: sessionThread.thread.topLevelTab,
        modeKey,
        workspaceContext,
    });

    return {
        created: true,
        ...(diffResult?.diff ? { diff: diffResult.diff } : {}),
        checkpoint: diffResult?.checkpoint ?? checkpoint,
    };
}
