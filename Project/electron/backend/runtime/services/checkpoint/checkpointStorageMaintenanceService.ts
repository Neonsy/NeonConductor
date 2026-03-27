import type { CheckpointForceCompactInput, CheckpointForceCompactResult } from '@/app/backend/runtime/contracts';
import { compactCheckpointStorage, getCheckpointStorageSummary } from '@/app/backend/runtime/services/checkpoint/compaction';
import {
    buildCheckpointStorageProjection,
    mapCompactionRunSummary,
} from '@/app/backend/runtime/services/checkpoint/checkpointPreviewBuilder';

export async function forceCompactCheckpointStorage(
    input: CheckpointForceCompactInput
): Promise<CheckpointForceCompactResult> {
    if (!input.confirm) {
        const storage = await getCheckpointStorageSummary(input.profileId);
        return {
            compacted: false,
            reason: 'confirmation_required',
            message: 'Checkpoint compaction requires explicit confirmation.',
            storage: buildCheckpointStorageProjection(storage),
        };
    }

    const result = await compactCheckpointStorage({
        profileId: input.profileId,
        triggerKind: 'manual',
        force: true,
    });

    return {
        compacted: result.run.status !== 'failed',
        ...(result.run.message ? { message: result.run.message } : {}),
        run: mapCompactionRunSummary(result.run),
        storage: buildCheckpointStorageProjection(result.storage),
    };
}
