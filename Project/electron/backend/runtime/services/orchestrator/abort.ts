import { orchestratorStore } from '@/app/backend/persistence/stores';
import type { EntityId } from '@/app/backend/runtime/contracts';
import { ActiveOrchestratorRunRegistry } from '@/app/backend/runtime/services/orchestrator/activeRunRegistry';
import { appendOrchestratorAbortedEvent } from '@/app/backend/runtime/services/orchestrator/events';
import { runExecutionService } from '@/app/backend/runtime/services/runExecution/service';
import { appLog } from '@/app/main/logging';

export async function abortOrchestratorRun(input: {
    profileId: string;
    orchestratorRunId: EntityId<'orch'>;
    activeRuns: ActiveOrchestratorRunRegistry;
}): Promise<{ aborted: false; reason: 'not_found' } | { aborted: true; runId: EntityId<'orch'> }> {
    const run = await orchestratorStore.getRunById(input.profileId, input.orchestratorRunId);
    if (!run) {
        return { aborted: false, reason: 'not_found' };
    }

    const active = input.activeRuns.cancel(input.orchestratorRunId);
    if (active) {
        await runExecutionService.abortRun(active.profileId, active.sessionId);
    }

    await orchestratorStore.setRunStatus(input.orchestratorRunId, { status: 'aborted' });
    const steps = await orchestratorStore.listSteps(input.orchestratorRunId);
    for (const step of steps) {
        if (step.status === 'pending' || step.status === 'running') {
            await orchestratorStore.setStepStatus(step.id, 'aborted');
        }
    }

    await appendOrchestratorAbortedEvent({
        profileId: input.profileId,
        orchestratorRunId: input.orchestratorRunId,
    });

    appLog.info({
        tag: 'orchestrator',
        message: 'Aborted orchestrator run.',
        profileId: input.profileId,
        orchestratorRunId: input.orchestratorRunId,
    });

    return {
        aborted: true,
        runId: input.orchestratorRunId,
    };
}
