import { err, ok, type Result } from 'neverthrow';

import { orchestratorStore, planStore } from '@/app/backend/persistence/stores';
import type {
    OrchestratorRunRecord,
    OrchestratorStepRecord,
    PlanItemRecord,
    PlanRecord,
} from '@/app/backend/persistence/types';
import type { EntityId, OrchestratorStartInput } from '@/app/backend/runtime/contracts';
import { executeOrchestratorSteps } from '@/app/backend/runtime/services/orchestrator/executionLoop';
import { runExecutionService } from '@/app/backend/runtime/services/runExecution/service';
import { runtimeStatusEvent } from '@/app/backend/runtime/services/runtimeEventEnvelope';
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

        await runtimeEventLogService.append(
            runtimeStatusEvent({
            entityType: 'orchestrator',
            domain: 'orchestrator',
            entityId: created.run.id,
            eventType: 'orchestrator.started',
            payload: {
                profileId: input.profileId,
                sessionId: plan.sessionId,
                planId: plan.id,
                orchestratorRunId: created.run.id,
                stepCount: created.steps.length,
            },
            })
        );

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

        await runtimeEventLogService.append(
            runtimeStatusEvent({
            entityType: 'orchestrator',
            domain: 'orchestrator',
            entityId: orchestratorRunId,
            eventType: 'orchestrator.aborted',
            payload: {
                profileId,
                orchestratorRunId,
            },
            })
        );

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
        await executeOrchestratorSteps({
            ...input,
            activeRuns: this.activeRuns,
        });
    }
}

export const orchestratorExecutionService = new OrchestratorExecutionService();
