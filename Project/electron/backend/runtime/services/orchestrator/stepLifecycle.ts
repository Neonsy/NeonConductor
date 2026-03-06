import { orchestratorStore, planStore } from '@/app/backend/persistence/stores';
import type { OrchestratorStepRecord, PlanItemRecord, PlanRecord } from '@/app/backend/persistence/types';
import type { EntityId } from '@/app/backend/runtime/contracts';
import {
    appendOrchestratorCompletedEvent,
    appendOrchestratorStepCompletedEvent,
    appendOrchestratorStepStartedEvent,
} from '@/app/backend/runtime/services/orchestrator/events';
import { appLog } from '@/app/main/logging';

function findLinkedPlanItem(
    planItems: PlanItemRecord[],
    step: OrchestratorStepRecord
): PlanItemRecord | undefined {
    return planItems.find((item) => item.sequence === step.sequence);
}

export async function markStepStarted(input: {
    orchestratorRunId: EntityId<'orch'>;
    step: OrchestratorStepRecord;
    planItems: PlanItemRecord[];
}): Promise<void> {
    await orchestratorStore.setRunStatus(input.orchestratorRunId, {
        status: 'running',
        activeStepIndex: input.step.sequence,
    });
    await orchestratorStore.setStepStatus(input.step.id, 'running');

    const linkedPlanItem = findLinkedPlanItem(input.planItems, input.step);
    if (linkedPlanItem) {
        await planStore.setItemStatus(linkedPlanItem.id, 'running');
    }

    await appendOrchestratorStepStartedEvent({
        orchestratorRunId: input.orchestratorRunId,
        stepId: input.step.id,
        sequence: input.step.sequence,
    });

    appLog.debug({
        tag: 'orchestrator',
        message: 'Started orchestrator step execution.',
        orchestratorRunId: input.orchestratorRunId,
        stepId: input.step.id,
        sequence: input.step.sequence,
    });
}

export async function markStepRunAttached(input: {
    step: OrchestratorStepRecord;
    planItems: PlanItemRecord[];
    runId: EntityId<'run'>;
}): Promise<void> {
    await orchestratorStore.setStepStatus(input.step.id, 'running', input.runId);
    const linkedPlanItem = findLinkedPlanItem(input.planItems, input.step);
    if (linkedPlanItem) {
        await planStore.setItemStatus(linkedPlanItem.id, 'running', input.runId);
    }
}

export async function markStepCompleted(input: {
    orchestratorRunId: EntityId<'orch'>;
    step: OrchestratorStepRecord;
    planItems: PlanItemRecord[];
    runId: EntityId<'run'>;
}): Promise<void> {
    await orchestratorStore.setStepStatus(input.step.id, 'completed', input.runId);
    const linkedPlanItem = findLinkedPlanItem(input.planItems, input.step);
    if (linkedPlanItem) {
        await planStore.setItemStatus(linkedPlanItem.id, 'completed', input.runId);
    }

    await appendOrchestratorStepCompletedEvent({
        orchestratorRunId: input.orchestratorRunId,
        stepId: input.step.id,
        sequence: input.step.sequence,
        runId: input.runId,
    });

    appLog.debug({
        tag: 'orchestrator',
        message: 'Completed orchestrator step execution.',
        orchestratorRunId: input.orchestratorRunId,
        stepId: input.step.id,
        sequence: input.step.sequence,
        runId: input.runId,
    });
}

export async function markStepAborted(input: {
    orchestratorRunId: EntityId<'orch'>;
    step: OrchestratorStepRecord;
    planItems: PlanItemRecord[];
    runId: EntityId<'run'>;
}): Promise<void> {
    await orchestratorStore.setStepStatus(input.step.id, 'aborted', input.runId);
    const linkedPlanItem = findLinkedPlanItem(input.planItems, input.step);
    if (linkedPlanItem) {
        await planStore.setItemStatus(linkedPlanItem.id, 'aborted', input.runId);
    }
    await orchestratorStore.setRunStatus(input.orchestratorRunId, {
        status: 'aborted',
        activeStepIndex: input.step.sequence,
    });

    appLog.warn({
        tag: 'orchestrator',
        message: 'Orchestrator step run ended as aborted.',
        orchestratorRunId: input.orchestratorRunId,
        stepId: input.step.id,
        sequence: input.step.sequence,
        runId: input.runId,
    });
}

export async function markStepFailed(input: {
    orchestratorRunId: EntityId<'orch'>;
    step: OrchestratorStepRecord;
    planItems: PlanItemRecord[];
    runId?: EntityId<'run'>;
    errorMessage: string;
    planId: PlanRecord['id'];
}): Promise<void> {
    await orchestratorStore.setStepStatus(input.step.id, 'failed', input.runId, input.errorMessage);
    const linkedPlanItem = findLinkedPlanItem(input.planItems, input.step);
    if (linkedPlanItem) {
        await planStore.setItemStatus(linkedPlanItem.id, 'failed', input.runId, input.errorMessage);
    }
    await orchestratorStore.setRunStatus(input.orchestratorRunId, {
        status: 'failed',
        activeStepIndex: input.step.sequence,
        errorMessage: input.errorMessage,
    });
    await planStore.markFailed(input.planId);

    appLog.warn({
        tag: 'orchestrator',
        message: input.runId ? 'Orchestrator step run failed.' : 'Failed to start orchestrator step run.',
        orchestratorRunId: input.orchestratorRunId,
        stepId: input.step.id,
        sequence: input.step.sequence,
        ...(input.runId ? { runId: input.runId } : {}),
        error: input.errorMessage,
    });
}

export async function markOrchestratorCompleted(input: {
    orchestratorRunId: EntityId<'orch'>;
    planId: PlanRecord['id'];
    stepCount: number;
}): Promise<void> {
    await orchestratorStore.setRunStatus(input.orchestratorRunId, {
        status: 'completed',
        activeStepIndex: input.stepCount,
    });
    await planStore.markImplemented(input.planId);
    await appendOrchestratorCompletedEvent(input);

    appLog.info({
        tag: 'orchestrator',
        message: 'Completed orchestrator run.',
        orchestratorRunId: input.orchestratorRunId,
        planId: input.planId,
        stepCount: input.stepCount,
    });
}

export async function markOrchestratorStopped(input: {
    orchestratorRunId: EntityId<'orch'>;
}): Promise<void> {
    await orchestratorStore.setRunStatus(input.orchestratorRunId, { status: 'aborted' });
    appLog.warn({
        tag: 'orchestrator',
        message: 'Stopping orchestrator execution because run is no longer active.',
        orchestratorRunId: input.orchestratorRunId,
    });
}
