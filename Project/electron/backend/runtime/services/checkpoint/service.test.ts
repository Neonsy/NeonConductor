import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    ensureCheckpointForRunLifecycle: vi.fn(),
}));

vi.mock('@/app/backend/runtime/services/checkpoint/checkpointCaptureLifecycle', async () => {
    const actual =
        await vi.importActual<typeof import('@/app/backend/runtime/services/checkpoint/checkpointCaptureLifecycle')>(
            '@/app/backend/runtime/services/checkpoint/checkpointCaptureLifecycle'
        );

    return {
        ...actual,
        ensureCheckpointForRunLifecycle: mocks.ensureCheckpointForRunLifecycle,
    };
});

import { errOp, okOp } from '@/app/backend/runtime/services/common/operationalError';
import { ensureCheckpointForRun } from '@/app/backend/runtime/services/checkpoint/service';

describe('ensureCheckpointForRun', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('delegates to the checkpoint capture lifecycle', async () => {
        const expected = okOp({ id: 'ckpt_1' });
        mocks.ensureCheckpointForRunLifecycle.mockResolvedValue(expected);

        const result = await ensureCheckpointForRun({
            profileId: 'profile_local_default',
            runId: 'run_1',
            sessionId: 'sess_1',
            threadId: 'thr_1',
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

        expect(result.isOk()).toBe(true);
        expect(result._unsafeUnwrap()).toEqual({ id: 'ckpt_1' });
        expect(mocks.ensureCheckpointForRunLifecycle).toHaveBeenCalledWith({
            profileId: 'profile_local_default',
            runId: 'run_1',
            sessionId: 'sess_1',
            threadId: 'thr_1',
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
    });

    it('preserves lifecycle errors', async () => {
        const expected = errOp(
            'checkpoint_execution_target_unresolved',
            'Mutating run checkpoint capture requires a resolved execution target.'
        );
        mocks.ensureCheckpointForRunLifecycle.mockResolvedValue(expected);

        const result = await ensureCheckpointForRun({
            profileId: 'profile_local_default',
            runId: 'run_1',
            sessionId: 'sess_1',
            threadId: 'thr_1',
            topLevelTab: 'agent',
            modeKey: 'code',
            workspaceContext: { kind: 'detached' },
        });

        expect(result.isErr()).toBe(true);
        expect(result._unsafeUnwrapErr().code).toBe('checkpoint_execution_target_unresolved');
    });
});
