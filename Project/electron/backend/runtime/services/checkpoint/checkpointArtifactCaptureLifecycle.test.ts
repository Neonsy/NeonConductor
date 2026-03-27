import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    checkpointChangesetStore: {
        replaceForCheckpoint: vi.fn(),
    },
    checkpointSnapshotStore: {
        listSnapshotEntries: vi.fn(),
    },
    checkpointStore: {
        attachDiff: vi.fn(),
        getByRunId: vi.fn(),
    },
    diffStore: {
        create: vi.fn(),
        listByRun: vi.fn(),
    },
    compactCheckpointStorage: vi.fn(),
    resolveCheckpointExecutionTarget: vi.fn(),
    captureGitWorkspaceArtifact: vi.fn(),
    captureExecutionTargetSnapshot: vi.fn(),
}));

vi.mock('@/app/backend/persistence/stores', () => ({
    checkpointChangesetStore: mocks.checkpointChangesetStore,
    checkpointSnapshotStore: mocks.checkpointSnapshotStore,
    checkpointStore: mocks.checkpointStore,
    diffStore: mocks.diffStore,
}));

vi.mock('@/app/backend/runtime/services/checkpoint/compaction', () => ({
    compactCheckpointStorage: mocks.compactCheckpointStorage,
}));

vi.mock('@/app/backend/runtime/services/checkpoint/executionTarget', () => ({
    resolveCheckpointExecutionTarget: mocks.resolveCheckpointExecutionTarget,
}));

vi.mock('@/app/backend/runtime/services/checkpoint/gitWorkspace', () => ({
    captureGitWorkspaceArtifact: mocks.captureGitWorkspaceArtifact,
}));

vi.mock('@/app/backend/runtime/services/checkpoint/nativeSnapshot', () => ({
    captureExecutionTargetSnapshot: mocks.captureExecutionTargetSnapshot,
}));

import { ok } from 'neverthrow';
import {
    captureCheckpointDiffForRunLifecycle,
    captureRunDiffArtifact,
} from '@/app/backend/runtime/services/checkpoint/checkpointArtifactCaptureLifecycle';

describe('checkpointArtifactCaptureLifecycle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.compactCheckpointStorage.mockResolvedValue(undefined);
    });

    it('records unsupported diff artifacts for detached workspaces', async () => {
        mocks.diffStore.listByRun.mockResolvedValue([]);
        mocks.checkpointStore.getByRunId.mockResolvedValue({
            id: 'ckpt_1',
            checkpointKind: 'auto',
            summary: 'Before run',
        });
        mocks.diffStore.create.mockImplementation(async (input) => ({
            id: 'diff_1',
            ...input,
        }));
        mocks.checkpointStore.attachDiff.mockResolvedValue({
            id: 'ckpt_1',
            diffId: 'diff_1',
            summary: 'Diff capture unavailable',
        });

        const result = await captureRunDiffArtifact({
            profileId: 'profile_local_default',
            sessionId: 'sess_1',
            runId: 'run_1',
            topLevelTab: 'agent',
            modeKey: 'code',
            workspaceContext: { kind: 'detached' },
        });

        expect(result?.diff).toMatchObject({
            id: 'diff_1',
            summary: 'Diff capture unavailable',
            artifact: {
                kind: 'unsupported',
                reason: 'workspace_unresolved',
            },
        });
        expect(mocks.checkpointStore.attachDiff).toHaveBeenCalled();
    });

    it('captures diff and changeset together for mutating runs', async () => {
        mocks.diffStore.listByRun.mockResolvedValue([]);
        mocks.checkpointStore.getByRunId.mockResolvedValue({
            id: 'ckpt_1',
            sessionId: 'sess_1',
            threadId: 'thr_1',
            runId: 'run_1',
            executionTargetKey: 'workspace:ws_1',
            executionTargetKind: 'workspace',
            executionTargetLabel: 'Workspace Root',
            checkpointKind: 'auto',
            summary: 'Before run',
            snapshotFileCount: 1,
        });
        mocks.captureGitWorkspaceArtifact.mockResolvedValue({
            kind: 'git',
            workspaceRootPath: 'C:/repo',
            workspaceLabel: 'Workspace Root',
            fileCount: 2,
            entries: [],
        });
        mocks.diffStore.create.mockImplementation(async (input) => ({
            id: 'diff_1',
            ...input,
        }));
        mocks.checkpointStore.attachDiff.mockResolvedValue({
            id: 'ckpt_1',
            diffId: 'diff_1',
            summary: '2 changed files',
        });
        mocks.resolveCheckpointExecutionTarget.mockReturnValue({
            absolutePath: 'C:/repo',
            executionTargetKey: 'workspace:ws_1',
        });
        mocks.checkpointSnapshotStore.listSnapshotEntries.mockResolvedValue([
            { relativePath: 'a.txt', bytes: new Uint8Array([1]) },
        ]);
        mocks.captureExecutionTargetSnapshot.mockResolvedValue(
            ok({
                fileCount: 1,
                files: [{ relativePath: 'a.txt', bytes: new Uint8Array([2]) }],
            })
        );
        mocks.checkpointChangesetStore.replaceForCheckpoint.mockResolvedValue({
            id: 'chg_1',
            checkpointId: 'ckpt_1',
            sessionId: 'sess_1',
            threadId: 'thr_1',
            runId: 'run_1',
            executionTargetKey: 'workspace:ws_1',
            executionTargetKind: 'workspace',
            executionTargetLabel: 'Workspace Root',
            changesetKind: 'run_capture',
            changeCount: 1,
            summary: 'Changed 1 file',
        });

        const result = await captureCheckpointDiffForRunLifecycle({
            profileId: 'profile_local_default',
            sessionId: 'sess_1',
            runId: 'run_1',
            topLevelTab: 'agent',
            modeKey: 'code',
            workspaceContext: {
                kind: 'workspace',
                workspaceFingerprint: 'ws_1',
                absolutePath: 'C:/repo',
                label: 'Workspace Root',
                executionEnvironmentMode: 'local',
            },
        });

        expect(result).toMatchObject({
            diff: { id: 'diff_1' },
            checkpoint: { id: 'ckpt_1' },
            changeset: { id: 'chg_1' },
        });
    });
});
