import type { OrchestratorStepRecord, PlanItemRecord, PlanRecord } from '@/app/backend/persistence/types';
import type { EntityId, OrchestratorStartInput } from '@/app/backend/runtime/contracts';
import { ActiveOrchestratorRunRegistry } from '@/app/backend/runtime/services/orchestrator/activeRunRegistry';
import {
    markOrchestratorCompleted,
    markOrchestratorStopped,
    markStepAborted,
    markStepCompleted,
    markStepFailed,
    markStepRunAttached,
    markStepStarted,
} from '@/app/backend/runtime/services/orchestrator/stepLifecycle';
import { startOrchestratorStepRun, waitForRunTerminal } from '@/app/backend/runtime/services/orchestrator/stepRun';

export async function executeOrchestratorSteps(input: {
    plan: PlanRecord;
    planItems: PlanItemRecord[];
    orchestratorRunId: EntityId<'orch'>;
    steps: OrchestratorStepRecord[];
    startInput: OrchestratorStartInput;
    activeRuns: ActiveOrchestratorRunRegistry;
}): Promise<void> {
    for (const step of input.steps) {
        const active = input.activeRuns.get(input.orchestratorRunId);
        if (!active || active.cancelled) {
            await markOrchestratorStopped({
                orchestratorRunId: input.orchestratorRunId,
            });
            return;
        }

        await markStepStarted({
            orchestratorRunId: input.orchestratorRunId,
            step,
            planItems: input.planItems,
        });

        const started = await startOrchestratorStepRun({
            plan: input.plan,
            step,
            startInput: input.startInput,
        });

        if (!started.accepted) {
            await markStepFailed({
                orchestratorRunId: input.orchestratorRunId,
                step,
                planItems: input.planItems,
                errorMessage: started.reason,
                planId: input.plan.id,
            });
            return;
        }

        await markStepRunAttached({
            step,
            planItems: input.planItems,
            runId: started.runId,
        });

        const terminalStatus = await waitForRunTerminal(started.runId);
        if (terminalStatus === 'completed') {
            await markStepCompleted({
                orchestratorRunId: input.orchestratorRunId,
                step,
                planItems: input.planItems,
                runId: started.runId,
            });
            continue;
        }

        if (terminalStatus === 'aborted') {
            await markStepAborted({
                orchestratorRunId: input.orchestratorRunId,
                step,
                planItems: input.planItems,
                runId: started.runId,
            });
            return;
        }

        await markStepFailed({
            orchestratorRunId: input.orchestratorRunId,
            step,
            planItems: input.planItems,
            runId: started.runId,
            errorMessage: 'Step run ended with error.',
            planId: input.plan.id,
        });
        return;
    }

    await markOrchestratorCompleted({
        orchestratorRunId: input.orchestratorRunId,
        planId: input.plan.id,
        stepCount: input.steps.length,
    });
}
