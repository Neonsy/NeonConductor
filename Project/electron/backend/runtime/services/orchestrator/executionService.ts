import { err, ok, type Result } from 'neverthrow';

import { orchestratorStore, planStore, runStore } from '@/app/backend/persistence/stores';
import type {
    OrchestratorRunRecord,
    OrchestratorStepRecord,
    PlanItemRecord,
    PlanRecord,
} from '@/app/backend/persistence/types';
import type { EntityId, OrchestratorStartInput } from '@/app/backend/runtime/contracts';
import { runExecutionService } from '@/app/backend/runtime/services/runExecution/service';
import { runtimeEventLogService } from '@/app/backend/runtime/services/runtimeEventLog';
import { appLog } from '@/app/main/logging';

interface ActiveOrchestratorRun {
    profileId: string;
    sessionId: EntityId<'sess'>;
    cancelled: boolean;
}

type OrchestratorExecutionErrorCode = 'plan_not_found' | 'invalid_tab' | 'plan_not_approved';

interface OrchestratorExecutionError {
    code: OrchestratorExecutionErrorCode;
    message: string;
}

function okOrchestrator<T>(value: T): Result<T, OrchestratorExecutionError> {
    return ok(value);
}

function errOrchestrator(
    code: OrchestratorExecutionErrorCode,
    message: string
): Result<never, OrchestratorExecutionError> {
    return err({
        code,
        message,
    });
}

function toOrchestratorException(error: OrchestratorExecutionError): Error {
    const exception = new Error(error.message);
    (exception as { code?: string }).code = error.code;
    return exception;
}

function validateOrchestratorStart(
    plan: PlanRecord | null | undefined,
    planId: EntityId<'plan'>
): Result<PlanRecord, OrchestratorExecutionError> {
    if (!plan) {
        return errOrchestrator('plan_not_found', `Plan "${planId}" was not found.`);
    }
    if (plan.topLevelTab !== 'orchestrator') {
        return errOrchestrator('invalid_tab', 'Orchestrator runs can only start from orchestrator plans.');
    }
    if (plan.status !== 'approved' && plan.status !== 'implementing') {
        return errOrchestrator('plan_not_approved', `Plan "${plan.id}" must be approved before orchestration.`);
    }

    return okOrchestrator(plan);
}

function buildStepPrompt(plan: PlanRecord, step: OrchestratorStepRecord): string {
    return [
        `Execute step ${String(step.sequence)} from approved orchestrator plan.`,
        '',
        `Plan summary:`,
        plan.summaryMarkdown,
        '',
        `Step task:`,
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

export class OrchestratorExecutionService {
    private readonly activeRuns = new Map<EntityId<'orch'>, ActiveOrchestratorRun>();

    async start(
        input: OrchestratorStartInput
    ): Promise<{ started: true; run: OrchestratorRunRecord; steps: OrchestratorStepRecord[] }> {
        const validation = validateOrchestratorStart(
            await planStore.getById(input.profileId, input.planId),
            input.planId
        );
        if (validation.isErr()) {
            appLog.warn({
                tag: 'orchestrator',
                message: 'Rejected orchestrator.start request.',
                profileId: input.profileId,
                planId: input.planId,
                code: validation.error.code,
                error: validation.error.message,
            });
            throw toOrchestratorException(validation.error);
        }
        const plan = validation.value;

        const planItems = await planStore.listItems(plan.id);
        const stepDescriptions =
            planItems.length > 0
                ? planItems.map((item) => item.description)
                : [plan.summaryMarkdown || plan.sourcePrompt];

        const created = await orchestratorStore.createRun({
            profileId: input.profileId,
            sessionId: plan.sessionId,
            planId: plan.id,
            stepDescriptions,
        });

        await runtimeEventLogService.append({
            entityType: 'orchestrator',
            entityId: created.run.id,
            eventType: 'orchestrator.started',
            payload: {
                profileId: input.profileId,
                sessionId: plan.sessionId,
                planId: plan.id,
                orchestratorRunId: created.run.id,
                stepCount: created.steps.length,
            },
        });

        appLog.info({
            tag: 'orchestrator',
            message: 'Started orchestrator run.',
            profileId: input.profileId,
            sessionId: plan.sessionId,
            planId: plan.id,
            orchestratorRunId: created.run.id,
            stepCount: created.steps.length,
        });

        this.activeRuns.set(created.run.id, {
            profileId: input.profileId,
            sessionId: plan.sessionId,
            cancelled: false,
        });

        void this.executeSequentially({
            plan,
            planItems,
            orchestratorRunId: created.run.id,
            steps: created.steps,
            startInput: input,
        }).finally(() => {
            this.activeRuns.delete(created.run.id);
        });

        return {
            started: true,
            run: created.run,
            steps: created.steps,
        };
    }

    async getStatus(
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

    async getLatestBySession(
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

    async abort(
        profileId: string,
        orchestratorRunId: EntityId<'orch'>
    ): Promise<{ aborted: false; reason: 'not_found' } | { aborted: true; runId: EntityId<'orch'> }> {
        const run = await orchestratorStore.getRunById(profileId, orchestratorRunId);
        if (!run) {
            return { aborted: false, reason: 'not_found' };
        }

        const active = this.activeRuns.get(orchestratorRunId);
        if (active) {
            active.cancelled = true;
            await runExecutionService.abortRun(active.profileId, active.sessionId);
        }

        await orchestratorStore.setRunStatus(orchestratorRunId, { status: 'aborted' });
        const steps = await orchestratorStore.listSteps(orchestratorRunId);
        for (const step of steps) {
            if (step.status === 'pending' || step.status === 'running') {
                await orchestratorStore.setStepStatus(step.id, 'aborted');
            }
        }

        await runtimeEventLogService.append({
            entityType: 'orchestrator',
            entityId: orchestratorRunId,
            eventType: 'orchestrator.aborted',
            payload: {
                profileId,
                orchestratorRunId,
            },
        });

        appLog.info({
            tag: 'orchestrator',
            message: 'Aborted orchestrator run.',
            profileId,
            orchestratorRunId,
        });

        return {
            aborted: true,
            runId: orchestratorRunId,
        };
    }

    private async executeSequentially(input: {
        plan: PlanRecord;
        planItems: PlanItemRecord[];
        orchestratorRunId: EntityId<'orch'>;
        steps: OrchestratorStepRecord[];
        startInput: OrchestratorStartInput;
    }): Promise<void> {
        for (const step of input.steps) {
            const active = this.activeRuns.get(input.orchestratorRunId);
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

            await runtimeEventLogService.append({
                entityType: 'orchestrator',
                entityId: input.orchestratorRunId,
                eventType: 'orchestrator.step.started',
                payload: {
                    orchestratorRunId: input.orchestratorRunId,
                    stepId: step.id,
                    sequence: step.sequence,
                },
            });

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
                await runtimeEventLogService.append({
                    entityType: 'orchestrator',
                    entityId: input.orchestratorRunId,
                    eventType: 'orchestrator.step.completed',
                    payload: {
                        orchestratorRunId: input.orchestratorRunId,
                        stepId: step.id,
                        sequence: step.sequence,
                        runId: started.runId,
                    },
                });
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
        await runtimeEventLogService.append({
            entityType: 'orchestrator',
            entityId: input.orchestratorRunId,
            eventType: 'orchestrator.completed',
            payload: {
                orchestratorRunId: input.orchestratorRunId,
                planId: input.plan.id,
                stepCount: input.steps.length,
            },
        });
        appLog.info({
            tag: 'orchestrator',
            message: 'Completed orchestrator run.',
            orchestratorRunId: input.orchestratorRunId,
            planId: input.plan.id,
            stepCount: input.steps.length,
        });
    }
}

export const orchestratorExecutionService = new OrchestratorExecutionService();
