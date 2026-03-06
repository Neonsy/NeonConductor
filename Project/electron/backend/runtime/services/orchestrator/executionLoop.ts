import { orchestratorStore, planStore, runStore } from '@/app/backend/persistence/stores';
import type {
    OrchestratorStepRecord,
    PlanItemRecord,
    PlanRecord,
} from '@/app/backend/persistence/types';
import type { EntityId, OrchestratorStartInput } from '@/app/backend/runtime/contracts';
import { runExecutionService } from '@/app/backend/runtime/services/runExecution/service';
import { runtimeStatusEvent } from '@/app/backend/runtime/services/runtimeEventEnvelope';
import { runtimeEventLogService } from '@/app/backend/runtime/services/runtimeEventLog';
import { appLog } from '@/app/main/logging';

interface ActiveOrchestratorRun {
    profileId: string;
    sessionId: EntityId<'sess'>;
    cancelled: boolean;
}

function buildStepPrompt(plan: PlanRecord, step: OrchestratorStepRecord): string {
    return [
        `Execute step ${String(step.sequence)} from approved orchestrator plan.`,
        '',
        'Plan summary:',
        plan.summaryMarkdown,
        '',
        'Step task:',
        step.description,
    ].join('\n');
}

async function waitForRunTerminal(runId: EntityId<'run'>): Promise<'completed' | 'aborted' | 'error'> {
    for (;;) {
        const run = await runStore.getById(runId);
        if (!run) {
            return 'error';
        }

        if (run.status === 'completed' || run.status === 'aborted' || run.status === 'error') {
            return run.status;
        }

        await new Promise((resolve) => setTimeout(resolve, 200));
    }
}

export async function executeOrchestratorSteps(input: {
    plan: PlanRecord;
    planItems: PlanItemRecord[];
    orchestratorRunId: EntityId<'orch'>;
    steps: OrchestratorStepRecord[];
    startInput: OrchestratorStartInput;
    activeRuns: Map<EntityId<'orch'>, ActiveOrchestratorRun>;
}): Promise<void> {
    for (const step of input.steps) {
        const active = input.activeRuns.get(input.orchestratorRunId);
        if (!active || active.cancelled) {
            await orchestratorStore.setRunStatus(input.orchestratorRunId, { status: 'aborted' });
            appLog.warn({
                tag: 'orchestrator',
                message: 'Stopping orchestrator execution because run is no longer active.',
                orchestratorRunId: input.orchestratorRunId,
            });
            return;
        }

        await orchestratorStore.setRunStatus(input.orchestratorRunId, {
            status: 'running',
            activeStepIndex: step.sequence,
        });
        await orchestratorStore.setStepStatus(step.id, 'running');
        const linkedPlanItem = input.planItems.find((item) => item.sequence === step.sequence);
        if (linkedPlanItem) {
            await planStore.setItemStatus(linkedPlanItem.id, 'running');
        }

        await runtimeEventLogService.append(
            runtimeStatusEvent({
                entityType: 'orchestrator',
                domain: 'orchestrator',
                entityId: input.orchestratorRunId,
                eventType: 'orchestrator.step.started',
                payload: {
                    orchestratorRunId: input.orchestratorRunId,
                    stepId: step.id,
                    sequence: step.sequence,
                },
            })
        );

        appLog.debug({
            tag: 'orchestrator',
            message: 'Started orchestrator step execution.',
            orchestratorRunId: input.orchestratorRunId,
            stepId: step.id,
            sequence: step.sequence,
        });

        const started = await runExecutionService.startRun({
            profileId: input.startInput.profileId,
            sessionId: input.plan.sessionId,
            prompt: buildStepPrompt(input.plan, step),
            topLevelTab: 'orchestrator',
            modeKey: 'orchestrate',
            runtimeOptions: input.startInput.runtimeOptions,
            ...(input.startInput.providerId ? { providerId: input.startInput.providerId } : {}),
            ...(input.startInput.modelId ? { modelId: input.startInput.modelId } : {}),
            ...(input.startInput.workspaceFingerprint
                ? { workspaceFingerprint: input.startInput.workspaceFingerprint }
                : {}),
        });

        if (!started.accepted) {
            await orchestratorStore.setStepStatus(step.id, 'failed', undefined, started.reason);
            if (linkedPlanItem) {
                await planStore.setItemStatus(linkedPlanItem.id, 'failed', undefined, started.reason);
            }
            await orchestratorStore.setRunStatus(input.orchestratorRunId, {
                status: 'failed',
                activeStepIndex: step.sequence,
                errorMessage: started.reason,
            });
            await planStore.markFailed(input.plan.id);
            appLog.warn({
                tag: 'orchestrator',
                message: 'Failed to start orchestrator step run.',
                orchestratorRunId: input.orchestratorRunId,
                stepId: step.id,
                sequence: step.sequence,
                reason: started.reason,
            });
            return;
        }

        await orchestratorStore.setStepStatus(step.id, 'running', started.runId);
        if (linkedPlanItem) {
            await planStore.setItemStatus(linkedPlanItem.id, 'running', started.runId);
        }

        const terminalStatus = await waitForRunTerminal(started.runId);
        if (terminalStatus === 'completed') {
            await orchestratorStore.setStepStatus(step.id, 'completed', started.runId);
            if (linkedPlanItem) {
                await planStore.setItemStatus(linkedPlanItem.id, 'completed', started.runId);
            }
            await runtimeEventLogService.append(
                runtimeStatusEvent({
                    entityType: 'orchestrator',
                    domain: 'orchestrator',
                    entityId: input.orchestratorRunId,
                    eventType: 'orchestrator.step.completed',
                    payload: {
                        orchestratorRunId: input.orchestratorRunId,
                        stepId: step.id,
                        sequence: step.sequence,
                        runId: started.runId,
                    },
                })
            );
            appLog.debug({
                tag: 'orchestrator',
                message: 'Completed orchestrator step execution.',
                orchestratorRunId: input.orchestratorRunId,
                stepId: step.id,
                sequence: step.sequence,
                runId: started.runId,
            });
            continue;
        }

        if (terminalStatus === 'aborted') {
            await orchestratorStore.setStepStatus(step.id, 'aborted', started.runId);
            if (linkedPlanItem) {
                await planStore.setItemStatus(linkedPlanItem.id, 'aborted', started.runId);
            }
            await orchestratorStore.setRunStatus(input.orchestratorRunId, {
                status: 'aborted',
                activeStepIndex: step.sequence,
            });
            appLog.warn({
                tag: 'orchestrator',
                message: 'Orchestrator step run ended as aborted.',
                orchestratorRunId: input.orchestratorRunId,
                stepId: step.id,
                sequence: step.sequence,
                runId: started.runId,
            });
            return;
        }

        await orchestratorStore.setStepStatus(step.id, 'failed', started.runId, 'Step run ended with error.');
        if (linkedPlanItem) {
            await planStore.setItemStatus(linkedPlanItem.id, 'failed', started.runId, 'Step run ended with error.');
        }
        await orchestratorStore.setRunStatus(input.orchestratorRunId, {
            status: 'failed',
            activeStepIndex: step.sequence,
            errorMessage: 'Step run ended with error.',
        });
        await planStore.markFailed(input.plan.id);
        appLog.warn({
            tag: 'orchestrator',
            message: 'Orchestrator step run failed.',
            orchestratorRunId: input.orchestratorRunId,
            stepId: step.id,
            sequence: step.sequence,
            runId: started.runId,
        });
        return;
    }

    await orchestratorStore.setRunStatus(input.orchestratorRunId, {
        status: 'completed',
        activeStepIndex: input.steps.length,
    });
    await planStore.markImplemented(input.plan.id);
    await runtimeEventLogService.append(
        runtimeStatusEvent({
            entityType: 'orchestrator',
            domain: 'orchestrator',
            entityId: input.orchestratorRunId,
            eventType: 'orchestrator.completed',
            payload: {
                orchestratorRunId: input.orchestratorRunId,
                planId: input.plan.id,
                stepCount: input.steps.length,
            },
        })
    );
    appLog.info({
        tag: 'orchestrator',
        message: 'Completed orchestrator run.',
        orchestratorRunId: input.orchestratorRunId,
        planId: input.plan.id,
        stepCount: input.steps.length,
    });
}
