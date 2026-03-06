import { orchestratorStore } from '@/app/backend/persistence/stores';
import type { OrchestratorRunRecord, OrchestratorStepRecord } from '@/app/backend/persistence/types';
import type { EntityId } from '@/app/backend/runtime/contracts';

export async function getOrchestratorStatus(
    profileId: string,
    orchestratorRunId: EntityId<'orch'>
): Promise<{ found: false } | { found: true; run: OrchestratorRunRecord; steps: OrchestratorStepRecord[] }> {
    const run = await orchestratorStore.getRunById(profileId, orchestratorRunId);
    if (!run) {
        return { found: false };
    }

    return {
        found: true,
        run,
        steps: await orchestratorStore.listSteps(orchestratorRunId),
    };
}

export async function getLatestOrchestratorBySession(
    profileId: string,
    sessionId: EntityId<'sess'>
): Promise<{ found: false } | { found: true; run: OrchestratorRunRecord; steps: OrchestratorStepRecord[] }> {
    const run = await orchestratorStore.getLatestBySession(profileId, sessionId);
    if (!run) {
        return { found: false };
    }

    return {
        found: true,
        run,
        steps: await orchestratorStore.listSteps(run.id),
    };
}
