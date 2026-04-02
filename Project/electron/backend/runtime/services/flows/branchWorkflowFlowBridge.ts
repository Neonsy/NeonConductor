import { createHash, randomUUID } from 'node:crypto';

import { getPersistence } from '@/app/backend/persistence/db';
import { nowIso } from '@/app/backend/persistence/stores/shared/utils';
import type { FlowDefinitionRecord, FlowInstanceRecord, FlowLifecycleEvent, FlowStepDefinition } from '@/app/backend/runtime/contracts';
import { eventMetadata } from '@/app/backend/runtime/services/common/logContext';
import {
    completeFlowInstance,
    completeFlowStep,
    createFlowInstanceRecord,
    failFlowInstance,
    normalizeFlowDefinition,
    requireFlowApproval,
    startFlowInstance,
} from '@/app/backend/runtime/services/flows/skeleton';
import { runtimeStatusEvent } from '@/app/backend/runtime/services/runtimeEventEnvelope';
import { runtimeEventLogService } from '@/app/backend/runtime/services/runtimeEventLog';

function buildBranchWorkflowFlowDefinitionId(input: {
    profileId: string;
    workspaceFingerprint: string;
    branchWorkflowId: string;
}): string {
    const digest = createHash('sha256')
        .update([input.profileId, input.workspaceFingerprint, input.branchWorkflowId].join('\u0000'))
        .digest('hex');

    return `flow_branch_${digest}`;
}

function rekeyBranchWorkflowAdapterStepIds(
    flowDefinition: FlowDefinitionRecord,
    hiddenDefinitionId: string
): FlowDefinitionRecord {
    return {
        ...flowDefinition,
        steps: flowDefinition.steps.map((step, index) => {
            const stepSuffix =
                step.kind === 'legacy_command' ? 'legacy_command' : `${step.kind}_${String(index + 1)}`;

            return {
                ...step,
                id: `${hiddenDefinitionId}:${stepSuffix}`,
            };
        }),
    };
}

function buildFlowLifecyclePayload(input: {
    flowDefinition: FlowDefinitionRecord;
    flowInstance: FlowInstanceRecord;
    eventKind: FlowLifecycleEvent['kind'];
    step?: FlowStepDefinition;
    stepIndex?: number;
    reason?: string;
    message?: string;
    completedStepCount?: number;
}): Record<string, unknown> {
    const basePayload = {
        flowDefinitionId: input.flowDefinition.id,
        flowInstanceId: input.flowInstance.id,
    };

    if (input.eventKind === 'flow.started') {
        return {
            ...basePayload,
            triggerKind: input.flowDefinition.triggerKind,
            stepCount: input.flowDefinition.steps.length,
            status: 'queued',
        };
    }

    if (input.eventKind === 'flow.step_started' || input.eventKind === 'flow.step_completed') {
        if (!input.step || input.stepIndex === undefined) {
            throw new Error(`Flow lifecycle event "${input.eventKind}" requires a step and step index.`);
        }

        return {
            ...basePayload,
            stepIndex: input.stepIndex,
            stepId: input.step.id,
            stepKind: input.step.kind,
            status: 'running',
        };
    }

    if (input.eventKind === 'flow.approval_required') {
        if (!input.step || input.stepIndex === undefined) {
            throw new Error('Flow approval lifecycle event requires a step and step index.');
        }

        return {
            ...basePayload,
            stepIndex: input.stepIndex,
            stepId: input.step.id,
            stepKind: input.step.kind,
            reason: input.reason ?? 'Flow requires approval before continuing.',
            status: 'approval_required',
        };
    }

    if (input.eventKind === 'flow.failed') {
        return {
            ...basePayload,
            errorMessage: input.message ?? 'Flow execution failed.',
            status: 'failed',
            ...(input.step ? { stepId: input.step.id, stepKind: input.step.kind } : {}),
            ...(input.stepIndex !== undefined ? { stepIndex: input.stepIndex } : {}),
        };
    }

    if (input.eventKind === 'flow.cancelled') {
        return {
            ...basePayload,
            reason: input.reason ?? 'Flow execution was cancelled.',
            status: 'cancelled',
            ...(input.step ? { stepId: input.step.id, stepKind: input.step.kind } : {}),
            ...(input.stepIndex !== undefined ? { stepIndex: input.stepIndex } : {}),
        };
    }

    return {
        ...basePayload,
        completedStepCount: input.completedStepCount ?? input.flowDefinition.steps.length,
        status: 'completed',
    };
}

async function saveFlowDefinition(input: {
    profileId: string;
    workspaceFingerprint: string;
    branchWorkflowId: string;
    flowDefinition: FlowDefinitionRecord;
}): Promise<FlowDefinitionRecord> {
    const { db } = getPersistence();
    const now = nowIso();
    const hiddenDefinitionId = buildBranchWorkflowFlowDefinitionId({
        profileId: input.profileId,
        workspaceFingerprint: input.workspaceFingerprint,
        branchWorkflowId: input.branchWorkflowId,
    });
    const normalizedDefinition = rekeyBranchWorkflowAdapterStepIds(
        normalizeFlowDefinition({
            ...input.flowDefinition,
            id: hiddenDefinitionId,
            createdAt: now,
            updatedAt: now,
        }),
        hiddenDefinitionId
    );

    await db
        .insertInto('flow_definitions')
        .values({
            id: normalizedDefinition.id,
            profile_id: input.profileId,
            origin_kind: 'branch_workflow_adapter',
            workspace_fingerprint: input.workspaceFingerprint,
            source_branch_workflow_id: input.branchWorkflowId,
            label: normalizedDefinition.label,
            description: normalizedDefinition.description ?? null,
            enabled: normalizedDefinition.enabled ? 1 : 0,
            trigger_kind: normalizedDefinition.triggerKind,
            steps_json: JSON.stringify(normalizedDefinition.steps),
            created_at: normalizedDefinition.createdAt,
            updated_at: normalizedDefinition.updatedAt,
        })
        .onConflict((oc) =>
            oc.column('id').doUpdateSet({
                profile_id: input.profileId,
                origin_kind: 'branch_workflow_adapter',
                workspace_fingerprint: input.workspaceFingerprint,
                source_branch_workflow_id: input.branchWorkflowId,
                label: normalizedDefinition.label,
                description: normalizedDefinition.description ?? null,
                enabled: normalizedDefinition.enabled ? 1 : 0,
                trigger_kind: normalizedDefinition.triggerKind,
                steps_json: JSON.stringify(normalizedDefinition.steps),
                updated_at: normalizedDefinition.updatedAt,
            })
        )
        .execute();

    return normalizedDefinition;
}

async function saveFlowInstance(input: {
    profileId: string;
    flowDefinition: FlowDefinitionRecord;
    flowInstance: FlowInstanceRecord;
    now?: string;
}): Promise<void> {
    const { db } = getPersistence();
    const at = input.now ?? nowIso();

    await db
        .insertInto('flow_instances')
        .values({
            id: input.flowInstance.id,
            profile_id: input.profileId,
            flow_definition_id: input.flowDefinition.id,
            status: input.flowInstance.status,
            current_step_index: input.flowInstance.currentStepIndex,
            definition_snapshot_json: JSON.stringify(input.flowDefinition),
            started_at: input.flowInstance.startedAt ?? null,
            finished_at: input.flowInstance.finishedAt ?? null,
            created_at: at,
            updated_at: at,
        })
        .onConflict((oc) =>
            oc.column('id').doUpdateSet({
                profile_id: input.profileId,
                flow_definition_id: input.flowDefinition.id,
                status: input.flowInstance.status,
                current_step_index: input.flowInstance.currentStepIndex,
                definition_snapshot_json: JSON.stringify(input.flowDefinition),
                started_at: input.flowInstance.startedAt ?? null,
                finished_at: input.flowInstance.finishedAt ?? null,
                updated_at: at,
            })
        )
        .execute();
}

async function appendFlowLifecycleEvent(input: {
    profileId: string;
    flowDefinition: FlowDefinitionRecord;
    flowInstance: FlowInstanceRecord;
    eventKind: FlowLifecycleEvent['kind'];
    step?: FlowStepDefinition;
    stepIndex?: number;
    reason?: string;
    message?: string;
    completedStepCount?: number;
}): Promise<void> {
    const at = nowIso();
    await runtimeEventLogService.append(
        runtimeStatusEvent({
            entityType: 'flow',
            domain: 'flow',
            entityId: input.flowInstance.id,
            eventType: input.eventKind,
            payload: buildFlowLifecyclePayload({
                flowDefinition: input.flowDefinition,
                flowInstance: input.flowInstance,
                eventKind: input.eventKind,
                ...(input.step ? { step: input.step } : {}),
                ...(input.stepIndex !== undefined ? { stepIndex: input.stepIndex } : {}),
                ...(input.reason ? { reason: input.reason } : {}),
                ...(input.message ? { message: input.message } : {}),
                ...(input.completedStepCount !== undefined ? { completedStepCount: input.completedStepCount } : {}),
            }),
            ...eventMetadata({
                origin: 'runtime.branchWorkflow.flowBridge',
            }),
        })
    );
    await saveFlowInstance({
        profileId: input.profileId,
        flowDefinition: input.flowDefinition,
        flowInstance: input.flowInstance,
        now: at,
    });
}

export interface BranchWorkflowFlowExecutionContext {
    flowDefinitionId: string;
    flowInstanceId: string;
    flowDefinition: FlowDefinitionRecord;
    flowInstance: FlowInstanceRecord;
}

export async function startBranchWorkflowFlowExecution(input: {
    profileId: string;
    workspaceFingerprint: string;
    branchWorkflowId: string;
    flowDefinition: FlowDefinitionRecord;
}): Promise<BranchWorkflowFlowExecutionContext> {
    const flowDefinition = await saveFlowDefinition(input);
    const initialFlowInstance = createFlowInstanceRecord({
        flowDefinition,
        flowInstanceId: `flow_instance_${randomUUID()}`,
    });
    const started = startFlowInstance({
        flowDefinition,
        flowInstance: initialFlowInstance,
    });

    await saveFlowInstance({
        profileId: input.profileId,
        flowDefinition,
        flowInstance: started.flowInstance,
        now: started.event.at,
    });
    await appendFlowLifecycleEvent({
        profileId: input.profileId,
        flowDefinition,
        flowInstance: started.flowInstance,
        eventKind: started.event.kind,
    });

    return {
        flowDefinitionId: flowDefinition.id,
        flowInstanceId: started.flowInstance.id,
        flowDefinition,
        flowInstance: started.flowInstance,
    };
}

export async function startBranchWorkflowFlowStep(input: {
    profileId: string;
    flowDefinition: FlowDefinitionRecord;
    flowInstance: FlowInstanceRecord;
    stepIndex: number;
}): Promise<BranchWorkflowFlowExecutionContext> {
    const step = input.flowDefinition.steps[input.stepIndex];
    if (!step) {
        throw new Error(`Flow "${input.flowDefinition.id}" does not have a step at index ${String(input.stepIndex)}.`);
    }

    await appendFlowLifecycleEvent({
        profileId: input.profileId,
        flowDefinition: input.flowDefinition,
        flowInstance: input.flowInstance,
        eventKind: 'flow.step_started',
        step,
        stepIndex: input.stepIndex,
    });

    return {
        flowDefinitionId: input.flowDefinition.id,
        flowInstanceId: input.flowInstance.id,
        flowDefinition: input.flowDefinition,
        flowInstance: input.flowInstance,
    };
}

export async function markBranchWorkflowFlowApprovalRequired(input: {
    profileId: string;
    flowDefinition: FlowDefinitionRecord;
    flowInstance: FlowInstanceRecord;
    stepIndex: number;
    reason: string;
}): Promise<BranchWorkflowFlowExecutionContext> {
    const step = input.flowDefinition.steps[input.stepIndex];
    if (!step) {
        throw new Error(`Flow "${input.flowDefinition.id}" does not have a step at index ${String(input.stepIndex)}.`);
    }

    const approval = requireFlowApproval({
        flowDefinition: input.flowDefinition,
        flowInstance: input.flowInstance,
        stepIndex: input.stepIndex,
    });

    await saveFlowInstance({
        profileId: input.profileId,
        flowDefinition: input.flowDefinition,
        flowInstance: approval.flowInstance,
        now: approval.event.at,
    });
    await appendFlowLifecycleEvent({
        profileId: input.profileId,
        flowDefinition: input.flowDefinition,
        flowInstance: approval.flowInstance,
        eventKind: approval.event.kind,
        step,
        stepIndex: input.stepIndex,
        reason: input.reason,
    });

    return {
        flowDefinitionId: input.flowDefinition.id,
        flowInstanceId: approval.flowInstance.id,
        flowDefinition: input.flowDefinition,
        flowInstance: approval.flowInstance,
    };
}

export async function markBranchWorkflowFlowFailure(input: {
    profileId: string;
    flowDefinition: FlowDefinitionRecord;
    flowInstance: FlowInstanceRecord;
    message: string;
    stepIndex?: number;
}): Promise<BranchWorkflowFlowExecutionContext> {
    const step = input.stepIndex === undefined ? undefined : input.flowDefinition.steps[input.stepIndex];
    if (input.stepIndex !== undefined && !step) {
        throw new Error(`Flow "${input.flowDefinition.id}" does not have a step at index ${String(input.stepIndex)}.`);
    }

    const failed = failFlowInstance({
        flowDefinition: input.flowDefinition,
        flowInstance: input.flowInstance,
        message: input.message,
        ...(input.stepIndex !== undefined ? { stepIndex: input.stepIndex } : {}),
    });

    await saveFlowInstance({
        profileId: input.profileId,
        flowDefinition: input.flowDefinition,
        flowInstance: failed.flowInstance,
        now: failed.event.at,
    });
    await appendFlowLifecycleEvent({
        profileId: input.profileId,
        flowDefinition: input.flowDefinition,
        flowInstance: failed.flowInstance,
        eventKind: failed.event.kind,
        ...(step ? { step } : {}),
        ...(input.stepIndex !== undefined ? { stepIndex: input.stepIndex } : {}),
        message: input.message,
    });

    return {
        flowDefinitionId: input.flowDefinition.id,
        flowInstanceId: failed.flowInstance.id,
        flowDefinition: input.flowDefinition,
        flowInstance: failed.flowInstance,
    };
}

export async function markBranchWorkflowFlowSuccess(input: {
    profileId: string;
    flowDefinition: FlowDefinitionRecord;
    flowInstance: FlowInstanceRecord;
    stepIndex: number;
}): Promise<BranchWorkflowFlowExecutionContext> {
    const step = input.flowDefinition.steps[input.stepIndex];
    if (!step) {
        throw new Error(`Flow "${input.flowDefinition.id}" does not have a step at index ${String(input.stepIndex)}.`);
    }

    const completedStep = completeFlowStep({
        flowDefinition: input.flowDefinition,
        flowInstance: input.flowInstance,
        stepIndex: input.stepIndex,
    });
    await appendFlowLifecycleEvent({
        profileId: input.profileId,
        flowDefinition: input.flowDefinition,
        flowInstance: input.flowInstance,
        eventKind: completedStep.kind,
        step,
        stepIndex: input.stepIndex,
    });

    const completed = completeFlowInstance({
        flowDefinition: input.flowDefinition,
        flowInstance: input.flowInstance,
    });
    await saveFlowInstance({
        profileId: input.profileId,
        flowDefinition: input.flowDefinition,
        flowInstance: completed.flowInstance,
        now: completed.event.at,
    });
    await appendFlowLifecycleEvent({
        profileId: input.profileId,
        flowDefinition: input.flowDefinition,
        flowInstance: completed.flowInstance,
        eventKind: completed.event.kind,
        completedStepCount: input.flowDefinition.steps.length,
    });

    return {
        flowDefinitionId: input.flowDefinition.id,
        flowInstanceId: completed.flowInstance.id,
        flowDefinition: input.flowDefinition,
        flowInstance: completed.flowInstance,
    };
}
