import {
    checkpointChangesetStore,
    checkpointSnapshotStore,
    checkpointStore,
    diffStore,
} from '@/app/backend/persistence/stores';
import type {
    CheckpointChangesetRecord,
    CheckpointRecord,
    DiffArtifact,
    DiffRecord,
} from '@/app/backend/persistence/types';
import type { ResolvedWorkspaceContext, TopLevelTab } from '@/app/backend/runtime/contracts';
import {
    buildSnapshotIndexFromCapture,
    buildSnapshotIndexFromEntries,
    deriveChangesetFromSnapshots,
} from '@/app/backend/runtime/services/checkpoint/changeset';
import { compactCheckpointStorage } from '@/app/backend/runtime/services/checkpoint/compaction';
import { resolveCheckpointExecutionTarget } from '@/app/backend/runtime/services/checkpoint/executionTarget';
import { captureGitWorkspaceArtifact } from '@/app/backend/runtime/services/checkpoint/gitWorkspace';
import { captureExecutionTargetSnapshot } from '@/app/backend/runtime/services/checkpoint/nativeSnapshot';

export function isMutatingCheckpointMode(topLevelTab: TopLevelTab, modeKey: string): boolean {
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

function summarizeDiffArtifact(artifact: DiffArtifact): string {
    if (artifact.kind === 'unsupported') {
        return 'Diff capture unavailable';
    }

    if (artifact.fileCount === 0) {
        return 'No file changes';
    }

    return `${String(artifact.fileCount)} changed ${artifact.fileCount === 1 ? 'file' : 'files'}`;
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

export async function captureRunDiffArtifact(input: {
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
        input.workspaceContext.kind === 'workspace' || input.workspaceContext.kind === 'sandbox'
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
        summary: summarizeDiffArtifact(artifact),
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
        summary: existingCheckpoint.checkpointKind === 'named' ? existingCheckpoint.summary : summarizeDiff(diff),
    });

    return {
        diff,
        ...(updatedCheckpoint ? { checkpoint: updatedCheckpoint } : { checkpoint: existingCheckpoint }),
    };
}

export async function captureRunChangeset(input: {
    profileId: string;
    runId: NonNullable<CheckpointRecord['runId']>;
    topLevelTab: CheckpointRecord['topLevelTab'];
    modeKey: string;
    workspaceContext: ResolvedWorkspaceContext;
}): Promise<CheckpointChangesetRecord | null> {
    if (!isMutatingCheckpointMode(input.topLevelTab, input.modeKey)) {
        return null;
    }

    const checkpoint = await checkpointStore.getByRunId(input.profileId, input.runId);
    if (!checkpoint) {
        return null;
    }

    const executionTarget = resolveCheckpointExecutionTarget(input.workspaceContext);
    if (!executionTarget || executionTarget.executionTargetKey !== checkpoint.executionTargetKey) {
        return null;
    }

    const snapshotEntries = await checkpointSnapshotStore.listSnapshotEntries(checkpoint.id);
    if (snapshotEntries.length === 0 && checkpoint.snapshotFileCount > 0) {
        return null;
    }

    const currentSnapshotResult = await captureExecutionTargetSnapshot({
        workspaceRootPath: executionTarget.absolutePath,
    });
    if (currentSnapshotResult.isErr()) {
        return null;
    }

    const derivedChangeset = deriveChangesetFromSnapshots({
        beforeFiles: buildSnapshotIndexFromEntries(snapshotEntries),
        afterFiles: buildSnapshotIndexFromCapture(currentSnapshotResult.value.files),
    });

    const changeset = await checkpointChangesetStore.replaceForCheckpoint({
        profileId: input.profileId,
        checkpointId: checkpoint.id,
        sessionId: checkpoint.sessionId,
        threadId: checkpoint.threadId,
        ...(checkpoint.runId ? { runId: checkpoint.runId } : {}),
        executionTargetKey: checkpoint.executionTargetKey,
        executionTargetKind: checkpoint.executionTargetKind,
        executionTargetLabel: checkpoint.executionTargetLabel,
        createdByKind: 'system',
        changesetKind: 'run_capture',
        summary: derivedChangeset.summary,
        entries: derivedChangeset.entries,
    });
    await compactCheckpointStorage({
        profileId: input.profileId,
        triggerKind: 'automatic',
        force: false,
    });

    return changeset;
}

export async function captureCheckpointDiffForRunLifecycle(input: {
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
    if (!isMutatingCheckpointMode(input.topLevelTab, input.modeKey)) {
        return null;
    }

    const [diffResult, changeset] = await Promise.all([
        captureRunDiffArtifact(input),
        captureRunChangeset({
            profileId: input.profileId,
            runId: input.runId,
            topLevelTab: input.topLevelTab,
            modeKey: input.modeKey,
            workspaceContext: input.workspaceContext,
        }),
    ]);

    if (!diffResult && !changeset) {
        return null;
    }

    return {
        ...(diffResult?.diff ? { diff: diffResult.diff } : {}),
        ...(diffResult?.checkpoint ? { checkpoint: diffResult.checkpoint } : {}),
        ...(changeset ? { changeset } : {}),
    };
}
