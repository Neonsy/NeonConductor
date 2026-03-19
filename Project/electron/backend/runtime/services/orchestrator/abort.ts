import { orchestratorStore, planStore } from '@/app/backend/persistence/stores';
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
        await Promise.all(
            [...active.childSessionIds].map((childSessionId) => runExecutionService.abortRun(active.profileId, childSessionId))
        );
    }

    await orchestratorStore.setRunStatus(input.orchestratorRunId, { status: 'aborted' });
    await planStore.markFailed(run.planId);

    const steps = await orchestratorStore.listSteps(input.orchestratorRunId);
    const planItems = await planStore.listItems(run.planId);
    for (const step of steps) {
        const linkedPlanItem = planItems.find((planItem) => planItem.sequence === step.sequence);
        if (step.status === 'pending' || step.status === 'running') {
            await orchestratorStore.updateStep(step.id, {
                status: 'aborted',
                activeRunId: null,
            });
            if (linkedPlanItem) {
                await planStore.setItemStatus(linkedPlanItem.id, 'aborted', step.runId ?? step.activeRunId);
            }
        } else if (linkedPlanItem && linkedPlanItem.status === 'running' && step.status === 'aborted') {
            await planStore.setItemStatus(linkedPlanItem.id, 'aborted', step.runId ?? step.activeRunId);
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
