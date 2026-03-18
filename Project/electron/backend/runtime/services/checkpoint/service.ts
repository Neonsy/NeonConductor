import { checkpointSnapshotStore, checkpointStore, diffStore, runStore, threadStore } from '@/app/backend/persistence/stores';
import type { CheckpointRecord, DiffArtifact, DiffRecord } from '@/app/backend/persistence/types';
import type {
    CheckpointRollbackInput,
    CheckpointRollbackPreview,
    CheckpointRollbackPreviewInput,
    CheckpointRollbackResult,
    ResolvedWorkspaceContext,
    TopLevelTab,
} from '@/app/backend/runtime/contracts';
import { isEntityId } from '@/app/backend/runtime/contracts';
import {
    listAffectedSessionsForExecutionTarget,
    resolveCheckpointExecutionTarget,
} from '@/app/backend/runtime/services/checkpoint/executionTarget';
import { captureGitWorkspaceArtifact } from '@/app/backend/runtime/services/checkpoint/gitWorkspace';
import {
    captureExecutionTargetSnapshot,
    restoreExecutionTargetSnapshot,
} from '@/app/backend/runtime/services/checkpoint/nativeSnapshot';
import { workspaceContextService } from '@/app/backend/runtime/services/workspaceContext/service';

function isMutatingCheckpointMode(topLevelTab: TopLevelTab, modeKey: string): boolean {
    return (topLevelTab === 'agent' && modeKey === 'code') || topLevelTab === 'orchestrator';
}

function summarizeDiff(diff: DiffRecord): string {
    if (diff.artifact.kind === 'unsupported') {
        return 'Diff capture unavailable';
    }

    if (diff.artifact.fileCount === 0) {
        return 'No file changes';
    }

    return `${String(diff.artifact.fileCount)} changed ${diff.artifact.fileCount === 1 ? 'file' : 'files'}`;
}

function unsupportedArtifact(input: {
    workspaceRootPath: string;
    workspaceLabel: string;
    reason: Extract<DiffArtifact, { kind: 'unsupported' }>['reason'];
    detail: string;
}): Extract<DiffArtifact, { kind: 'unsupported' }> {
    return {
        kind: 'unsupported',
        workspaceRootPath: input.workspaceRootPath,
        workspaceLabel: input.workspaceLabel,
        reason: input.reason,
        detail: input.detail,
    };
}

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

async function createNativeCheckpointForResolvedTarget(input: {
    profileId: string;
    sessionId: CheckpointRecord['sessionId'];
    threadId: CheckpointRecord['threadId'];
    runId?: CheckpointRecord['runId'];
    topLevelTab: CheckpointRecord['topLevelTab'];
    modeKey: string;
    workspaceContext: ResolvedWorkspaceContext;
    createdByKind: CheckpointRecord['createdByKind'];
    checkpointKind: CheckpointRecord['checkpointKind'];
    summary?: string;
}): Promise<CheckpointRecord> {
    if (input.runId) {
        const existing = await checkpointStore.getByRunId(input.profileId, input.runId);
        if (existing) {
            return existing;
        }
    }

    const executionTarget = resolveCheckpointExecutionTarget(input.workspaceContext);
    if (!executionTarget) {
        throw new Error('Workspace execution target could not be resolved for checkpoint capture.');
    }

    const snapshotResult = await captureExecutionTargetSnapshot({
        workspaceRootPath: executionTarget.absolutePath,
    });
    if (snapshotResult.isErr()) {
        throw new Error(snapshotResult.error.detail);
    }

    const checkpoint = await checkpointStore.create({
        profileId: input.profileId,
        sessionId: input.sessionId,
        threadId: input.threadId,
        ...(input.runId ? { runId: input.runId } : {}),
        workspaceFingerprint: executionTarget.workspaceFingerprint,
        ...(executionTarget.worktreeId ? { worktreeId: executionTarget.worktreeId } : {}),
        executionTargetKey: executionTarget.executionTargetKey,
        executionTargetKind: executionTarget.executionTargetKind,
        executionTargetLabel: executionTarget.executionTargetLabel,
        createdByKind: input.createdByKind,
        checkpointKind: input.checkpointKind,
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
        return checkpoint;
    } catch (error) {
        await checkpointStore.deleteById(input.profileId, checkpoint.id);
        throw error;
    }
}

async function captureRunDiffArtifact(input: {
    profileId: string;
    sessionId: CheckpointRecord['sessionId'];
    runId: NonNullable<CheckpointRecord['runId']>;
    topLevelTab: CheckpointRecord['topLevelTab'];
    modeKey: string;
    workspaceContext: ResolvedWorkspaceContext;
}): Promise<{ diff: DiffRecord; checkpoint?: CheckpointRecord } | null> {
    if (!isMutatingCheckpointMode(input.topLevelTab, input.modeKey)) {
        return null;
    }

    const existingDiffs = await diffStore.listByRun(input.profileId, input.runId);
    const existingCheckpoint = await checkpointStore.getByRunId(input.profileId, input.runId);
    const firstDiff = existingDiffs[0];
    if (firstDiff) {
        return {
            diff: firstDiff,
            ...(existingCheckpoint ? { checkpoint: existingCheckpoint } : {}),
        };
    }

    const artifact =
        input.workspaceContext.kind === 'workspace' || input.workspaceContext.kind === 'worktree'
            ? await captureGitWorkspaceArtifact({
                  workspaceRootPath: input.workspaceContext.absolutePath,
                  workspaceLabel: input.workspaceContext.label,
              })
            : unsupportedArtifact({
                  workspaceRootPath: 'Unresolved workspace root',
                  workspaceLabel: 'Detached workspace',
                  reason: 'workspace_unresolved',
                  detail: 'Workspace root could not be resolved for this run.',
              });

    const diff = await diffStore.create({
        profileId: input.profileId,
        sessionId: input.sessionId,
        runId: input.runId,
        summary:
            artifact.kind === 'git'
                ? artifact.fileCount === 0
                    ? 'No file changes'
                    : `${String(artifact.fileCount)} changed ${artifact.fileCount === 1 ? 'file' : 'files'}`
                : 'Diff capture unavailable',
        artifact,
    });

    if (!existingCheckpoint) {
        return {
            diff,
        };
    }

    const updatedCheckpoint = await checkpointStore.attachDiff({
        profileId: input.profileId,
        checkpointId: existingCheckpoint.id,
        diffId: diff.id,
        summary: summarizeDiff(diff),
    });

    return {
        diff,
        ...(updatedCheckpoint ? { checkpoint: updatedCheckpoint } : { checkpoint: existingCheckpoint }),
    };
}

async function buildRollbackPreview(input: {
    profileId: string;
    checkpoint: CheckpointRecord;
}): Promise<CheckpointRollbackPreview> {
    const [affectedSessions, targetCheckpoints] = await Promise.all([
        listAffectedSessionsForExecutionTarget({
            profileId: input.profileId,
            executionTargetKey: input.checkpoint.executionTargetKey,
        }),
        checkpointStore.listByExecutionTargetKey(input.profileId, input.checkpoint.executionTargetKey),
    ]);

    const isSharedTarget = affectedSessions.some((session) => session.sessionId !== input.checkpoint.sessionId);
    const hasLaterForeignChanges = targetCheckpoints.some(
        (candidate) =>
            candidate.id !== input.checkpoint.id &&
            candidate.sessionId !== input.checkpoint.sessionId &&
            candidate.createdAt > input.checkpoint.createdAt
    );

    return {
        checkpointId: input.checkpoint.id,
        executionTargetKey: input.checkpoint.executionTargetKey,
        executionTargetKind: input.checkpoint.executionTargetKind,
        executionTargetLabel: input.checkpoint.executionTargetLabel,
        isSharedTarget,
        hasLaterForeignChanges,
        isHighRisk: isSharedTarget || hasLaterForeignChanges,
        affectedSessions,
    };
}

export async function ensureCheckpointForRun(input: {
    profileId: string;
    runId: NonNullable<CheckpointRecord['runId']>;
    sessionId: CheckpointRecord['sessionId'];
    threadId: CheckpointRecord['threadId'];
    topLevelTab: CheckpointRecord['topLevelTab'];
    modeKey: string;
    workspaceContext: ResolvedWorkspaceContext;
}): Promise<CheckpointRecord | null> {
    if (!isMutatingCheckpointMode(input.topLevelTab, input.modeKey)) {
        return null;
    }

    if (!resolveCheckpointExecutionTarget(input.workspaceContext)) {
        throw new Error('Mutating run checkpoint capture requires a resolved execution target.');
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

export async function listCheckpoints(input: {
    profileId: string;
    sessionId: CheckpointRecord['sessionId'];
}): Promise<{ checkpoints: CheckpointRecord[] }> {
    return {
        checkpoints: await checkpointStore.listBySession(input.profileId, input.sessionId),
    };
}

export async function createCheckpoint(input: {
    profileId: string;
    runId: NonNullable<CheckpointRecord['runId']>;
}): Promise<{ created: boolean; reason?: 'not_found' | 'unsupported_run'; diff?: DiffRecord; checkpoint?: CheckpointRecord }> {
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

    const workspaceContext = await workspaceContextService.resolveForSession({
        profileId: input.profileId,
        sessionId: run.sessionId,
        allowLazyWorktreeCreation: false,
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

    const checkpoint = await createNativeCheckpointForResolvedTarget({
        profileId: input.profileId,
        sessionId: run.sessionId,
        threadId: sessionThread.thread.id,
        runId: run.id,
        topLevelTab: sessionThread.thread.topLevelTab,
        modeKey,
        workspaceContext,
        createdByKind: 'user',
        checkpointKind: 'named',
    });

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

export async function captureCheckpointDiffForRun(input: {
    profileId: string;
    sessionId: CheckpointRecord['sessionId'];
    runId: NonNullable<CheckpointRecord['runId']>;
    topLevelTab: CheckpointRecord['topLevelTab'];
    modeKey: string;
    workspaceContext: ResolvedWorkspaceContext;
}): Promise<{ diff: DiffRecord; checkpoint?: CheckpointRecord } | null> {
    return captureRunDiffArtifact(input);
}

export async function getRollbackPreview(
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
        preview: await buildRollbackPreview({
            profileId: input.profileId,
            checkpoint,
        }),
    };
}

export async function rollbackCheckpoint(input: CheckpointRollbackInput): Promise<CheckpointRollbackResult> {
    const checkpoint = await checkpointStore.getById(input.profileId, input.checkpointId);
    if (!checkpoint) {
        return {
            rolledBack: false,
            reason: 'not_found',
        };
    }

    const preview = await buildRollbackPreview({
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

    const workspaceContext = await workspaceContextService.resolveExplicit({
        profileId: input.profileId,
        workspaceFingerprint: checkpoint.workspaceFingerprint,
        ...(checkpoint.worktreeId ? { worktreeId: checkpoint.worktreeId } : {}),
    });
    const executionTarget = resolveCheckpointExecutionTarget(workspaceContext);
    if (!executionTarget || executionTarget.executionTargetKey !== checkpoint.executionTargetKey) {
        return {
            rolledBack: false,
            reason: 'workspace_unresolved',
            message: 'Workspace root could not be resolved for this checkpoint.',
            preview,
        };
    }

    const safetyCheckpoint = await createNativeCheckpointForResolvedTarget({
        profileId: input.profileId,
        sessionId: checkpoint.sessionId,
        threadId: checkpoint.threadId,
        topLevelTab: checkpoint.topLevelTab,
        modeKey: checkpoint.modeKey,
        workspaceContext,
        createdByKind: 'system',
        checkpointKind: 'safety',
        summary: `Safety checkpoint before restoring ${checkpoint.id}`,
    });

    const snapshotEntries = await checkpointSnapshotStore.listSnapshotEntries(checkpoint.id);
    if (snapshotEntries.length === 0 && checkpoint.snapshotFileCount > 0) {
        return {
            rolledBack: false,
            reason: 'snapshot_invalid',
            message: 'Checkpoint snapshot data is missing.',
            preview,
            safetyCheckpoint: {
                id: safetyCheckpoint.id,
                sessionId: safetyCheckpoint.sessionId,
                threadId: safetyCheckpoint.threadId,
                ...(safetyCheckpoint.runId ? { runId: safetyCheckpoint.runId } : {}),
                topLevelTab: safetyCheckpoint.topLevelTab,
                modeKey: safetyCheckpoint.modeKey,
            },
        };
    }

    const restoreResult = await restoreExecutionTargetSnapshot({
        workspaceRootPath: executionTarget.absolutePath,
        files: snapshotEntries.map((entry) => ({
            relativePath: entry.relativePath,
            bytes: entry.bytes,
        })),
    });
    if (restoreResult.isErr()) {
        return {
            rolledBack: false,
            reason: restoreResult.error.reason,
            message: restoreResult.error.detail,
            preview,
            safetyCheckpoint: {
                id: safetyCheckpoint.id,
                sessionId: safetyCheckpoint.sessionId,
                threadId: safetyCheckpoint.threadId,
                ...(safetyCheckpoint.runId ? { runId: safetyCheckpoint.runId } : {}),
                topLevelTab: safetyCheckpoint.topLevelTab,
                modeKey: safetyCheckpoint.modeKey,
            },
        };
    }

    return {
        rolledBack: true,
        checkpoint: {
            id: checkpoint.id,
            sessionId: checkpoint.sessionId,
            threadId: checkpoint.threadId,
            ...(checkpoint.runId ? { runId: checkpoint.runId } : {}),
            topLevelTab: checkpoint.topLevelTab,
            modeKey: checkpoint.modeKey,
        },
        preview,
        safetyCheckpoint: {
            id: safetyCheckpoint.id,
            sessionId: safetyCheckpoint.sessionId,
            threadId: safetyCheckpoint.threadId,
            ...(safetyCheckpoint.runId ? { runId: safetyCheckpoint.runId } : {}),
            topLevelTab: safetyCheckpoint.topLevelTab,
            modeKey: safetyCheckpoint.modeKey,
        },
    };
}
