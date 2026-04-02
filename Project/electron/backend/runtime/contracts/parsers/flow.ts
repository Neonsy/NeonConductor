import {
    flowDefinitionOriginKinds,
    flowInstanceStatuses,
    flowStepKinds,
    flowTriggerKinds,
    topLevelTabs,
    workflowCapabilities,
} from '@/app/backend/runtime/contracts/enums';
import {
    createParser,
    readArray,
    readBoolean,
    readProfileId,
    readEnumValue,
    readObject,
    readOptionalString,
    readString,
} from '@/app/backend/runtime/contracts/parsers/helpers';
import type {
    FlowDefinitionCreateInput,
    FlowDefinitionDeleteInput,
    FlowDefinitionGetInput,
    FlowDefinitionListInput,
    FlowDefinitionRecord,
    FlowDefinitionUpdateInput,
    FlowDefinitionView,
    FlowInstanceGetInput,
    FlowInstanceRecord,
    FlowInstanceListInput,
    FlowInstanceView,
    FlowStepDefinition,
} from '@/app/backend/runtime/contracts/types/flow';

import {
    flowLifecycleEventKinds,
    type FlowApprovalRequiredLifecycleEventPayload,
    type FlowCancelledLifecycleEventPayload,
    type FlowCompletedLifecycleEventPayload,
    type FlowFailedLifecycleEventPayload,
    type FlowLifecycleEvent,
    type FlowStartedLifecycleEventPayload,
    type FlowStepCompletedLifecycleEventPayload,
    type FlowStepStartedLifecycleEventPayload,
} from '@/shared/flowLifecycle';

function readNonNegativeInteger(value: unknown, field: string): number {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
        throw new Error(`Invalid "${field}": expected non-negative integer.`);
    }

    return value;
}

function parseFlowStepDefinition(input: unknown, field: string): FlowStepDefinition {
    const source = readObject(input, field);
    const kind = readEnumValue(source.kind, `${field}.kind`, flowStepKinds);

    if (kind === 'legacy_command') {
        return {
            kind,
            id: readString(source.id, `${field}.id`),
            label: readString(source.label, `${field}.label`),
            command: readString(source.command, `${field}.command`),
        };
    }

    if (kind === 'mode_run') {
        return {
            kind,
            id: readString(source.id, `${field}.id`),
            label: readString(source.label, `${field}.label`),
            topLevelTab: readEnumValue(source.topLevelTab, `${field}.topLevelTab`, topLevelTabs),
            modeKey: readString(source.modeKey, `${field}.modeKey`),
        };
    }

    if (kind === 'workflow') {
        return {
            kind,
            id: readString(source.id, `${field}.id`),
            label: readString(source.label, `${field}.label`),
            workflowCapability: readEnumValue(
                source.workflowCapability,
                `${field}.workflowCapability`,
                workflowCapabilities
            ),
        };
    }

    return {
        kind,
        id: readString(source.id, `${field}.id`),
        label: readString(source.label, `${field}.label`),
    };
}

export function parseFlowDefinitionRecord(input: unknown): FlowDefinitionRecord {
    const source = readObject(input, 'input');
    const description = readOptionalString(source.description, 'description');

    return {
        id: readString(source.id, 'id'),
        label: readString(source.label, 'label'),
        ...(description ? { description } : {}),
        enabled: readBoolean(source.enabled, 'enabled'),
        triggerKind: readEnumValue(source.triggerKind, 'triggerKind', flowTriggerKinds),
        steps: readArray(source.steps, 'steps').map((step, index) =>
            parseFlowStepDefinition(step, `steps[${String(index)}]`)
        ),
        createdAt: readString(source.createdAt, 'createdAt'),
        updatedAt: readString(source.updatedAt, 'updatedAt'),
    };
}

export function parseFlowInstanceRecord(input: unknown): FlowInstanceRecord {
    const source = readObject(input, 'input');
    const startedAt = readOptionalString(source.startedAt, 'startedAt');
    const finishedAt = readOptionalString(source.finishedAt, 'finishedAt');

    return {
        id: readString(source.id, 'id'),
        flowDefinitionId: readString(source.flowDefinitionId, 'flowDefinitionId'),
        status: readEnumValue(source.status, 'status', flowInstanceStatuses),
        currentStepIndex: readNonNegativeInteger(source.currentStepIndex, 'currentStepIndex'),
        ...(startedAt ? { startedAt } : {}),
        ...(finishedAt ? { finishedAt } : {}),
    };
}

export function parseFlowDefinitionListInput(input: unknown): FlowDefinitionListInput {
    const source = readObject(input, 'input');
    return {
        profileId: readProfileId(source),
    };
}

export function parseFlowDefinitionGetInput(input: unknown): FlowDefinitionGetInput {
    const source = readObject(input, 'input');
    return {
        profileId: readProfileId(source),
        flowDefinitionId: readString(source.flowDefinitionId, 'flowDefinitionId'),
    };
}

export function parseFlowDefinitionCreateInput(input: unknown): FlowDefinitionCreateInput {
    const source = readObject(input, 'input');
    const description = readOptionalString(source.description, 'description');

    return {
        profileId: readProfileId(source),
        label: readString(source.label, 'label'),
        ...(description ? { description } : {}),
        enabled: readBoolean(source.enabled, 'enabled'),
        triggerKind: readEnumValue(source.triggerKind, 'triggerKind', flowTriggerKinds),
        steps: readArray(source.steps, 'steps').map((step, index) =>
            parseFlowStepDefinition(step, `steps[${String(index)}]`)
        ),
    };
}

export function parseFlowDefinitionUpdateInput(input: unknown): FlowDefinitionUpdateInput {
    const source = readObject(input, 'input');
    const description = readOptionalString(source.description, 'description');

    return {
        profileId: readProfileId(source),
        flowDefinitionId: readString(source.flowDefinitionId, 'flowDefinitionId'),
        label: readString(source.label, 'label'),
        ...(description ? { description } : {}),
        enabled: readBoolean(source.enabled, 'enabled'),
        triggerKind: readEnumValue(source.triggerKind, 'triggerKind', flowTriggerKinds),
        steps: readArray(source.steps, 'steps').map((step, index) =>
            parseFlowStepDefinition(step, `steps[${String(index)}]`)
        ),
    };
}

export function parseFlowDefinitionDeleteInput(input: unknown): FlowDefinitionDeleteInput {
    const source = readObject(input, 'input');
    return {
        profileId: readProfileId(source),
        flowDefinitionId: readString(source.flowDefinitionId, 'flowDefinitionId'),
        confirm: readBoolean(source.confirm, 'confirm'),
    };
}

export function parseFlowInstanceListInput(input: unknown): FlowInstanceListInput {
    const source = readObject(input, 'input');
    return {
        profileId: readProfileId(source),
    };
}

export function parseFlowInstanceGetInput(input: unknown): FlowInstanceGetInput {
    const source = readObject(input, 'input');
    return {
        profileId: readProfileId(source),
        flowInstanceId: readString(source.flowInstanceId, 'flowInstanceId'),
    };
}

export function parseFlowDefinitionView(input: unknown): FlowDefinitionView {
    const source = readObject(input, 'input');
    const workspaceFingerprint = readOptionalString(source.workspaceFingerprint, 'workspaceFingerprint');
    const sourceBranchWorkflowId = readOptionalString(source.sourceBranchWorkflowId, 'sourceBranchWorkflowId');

    return {
        definition: parseFlowDefinitionRecord(source.definition),
        originKind: readEnumValue(source.originKind, 'originKind', flowDefinitionOriginKinds),
        ...(workspaceFingerprint ? { workspaceFingerprint } : {}),
        ...(sourceBranchWorkflowId ? { sourceBranchWorkflowId } : {}),
    };
}

export function parseFlowInstanceView(input: unknown): FlowInstanceView {
    const source = readObject(input, 'input');
    const workspaceFingerprint = readOptionalString(source.workspaceFingerprint, 'workspaceFingerprint');
    const sourceBranchWorkflowId = readOptionalString(source.sourceBranchWorkflowId, 'sourceBranchWorkflowId');

    return {
        instance: parseFlowInstanceRecord(source.instance),
        definitionSnapshot: parseFlowDefinitionRecord(source.definitionSnapshot),
        lifecycleEvents: readArray(source.lifecycleEvents, 'lifecycleEvents').map((event, index) =>
            parseFlowLifecycleEvent(event, `lifecycleEvents[${String(index)}]`)
        ),
        originKind: readEnumValue(source.originKind, 'originKind', flowDefinitionOriginKinds),
        ...(workspaceFingerprint ? { workspaceFingerprint } : {}),
        ...(sourceBranchWorkflowId ? { sourceBranchWorkflowId } : {}),
    };
}

export function parseFlowLifecycleEvent(input: unknown, field = 'input'): FlowLifecycleEvent {
    const source = readObject(input, field);
    const kind = readEnumValue(source.kind, 'kind', flowLifecycleEventKinds);
    const flowDefinitionId = readString(source.flowDefinitionId, 'flowDefinitionId');
    const flowInstanceId = readString(source.flowInstanceId, 'flowInstanceId');
    const at = readString(source.at, 'at');
    const id = readString(source.id, 'id');
    const payload = readObject(source.payload, 'payload');

    if (kind === 'flow.started') {
        return {
            id,
            kind,
            flowDefinitionId,
            flowInstanceId,
            at,
            payload: {
                triggerKind: readEnumValue(payload.triggerKind, 'payload.triggerKind', flowTriggerKinds),
                stepCount: readNonNegativeInteger(payload.stepCount, 'payload.stepCount'),
                status: 'queued',
            } satisfies FlowStartedLifecycleEventPayload,
        };
    }

    if (kind === 'flow.step_started') {
        return {
            id,
            kind,
            flowDefinitionId,
            flowInstanceId,
            at,
            payload: {
                stepIndex: readNonNegativeInteger(payload.stepIndex, 'payload.stepIndex'),
                stepId: readString(payload.stepId, 'payload.stepId'),
                stepKind: readEnumValue(payload.stepKind, 'payload.stepKind', flowStepKinds),
                status: 'running',
            } satisfies FlowStepStartedLifecycleEventPayload,
        };
    }

    if (kind === 'flow.step_completed') {
        return {
            id,
            kind,
            flowDefinitionId,
            flowInstanceId,
            at,
            payload: {
                stepIndex: readNonNegativeInteger(payload.stepIndex, 'payload.stepIndex'),
                stepId: readString(payload.stepId, 'payload.stepId'),
                stepKind: readEnumValue(payload.stepKind, 'payload.stepKind', flowStepKinds),
                status: 'running',
            } satisfies FlowStepCompletedLifecycleEventPayload,
        };
    }

    if (kind === 'flow.approval_required') {
        return {
            id,
            kind,
            flowDefinitionId,
            flowInstanceId,
            at,
            payload: {
                stepIndex: readNonNegativeInteger(payload.stepIndex, 'payload.stepIndex'),
                stepId: readString(payload.stepId, 'payload.stepId'),
                stepKind: readEnumValue(payload.stepKind, 'payload.stepKind', flowStepKinds),
                reason: readString(payload.reason, 'payload.reason'),
                status: 'approval_required',
            } satisfies FlowApprovalRequiredLifecycleEventPayload,
        };
    }

    if (kind === 'flow.failed') {
        return {
            id,
            kind,
            flowDefinitionId,
            flowInstanceId,
            at,
            payload: {
                errorMessage: readString(payload.errorMessage, 'payload.errorMessage'),
                status: 'failed',
                ...(payload.stepIndex !== undefined
                    ? { stepIndex: readNonNegativeInteger(payload.stepIndex, 'payload.stepIndex') }
                    : {}),
                ...(payload.stepId ? { stepId: readString(payload.stepId, 'payload.stepId') } : {}),
                ...(payload.stepKind ? { stepKind: readEnumValue(payload.stepKind, 'payload.stepKind', flowStepKinds) } : {}),
            } satisfies FlowFailedLifecycleEventPayload,
        };
    }

    if (kind === 'flow.cancelled') {
        return {
            id,
            kind,
            flowDefinitionId,
            flowInstanceId,
            at,
            payload: {
                status: 'cancelled',
                ...(payload.reason ? { reason: readString(payload.reason, 'payload.reason') } : {}),
                ...(payload.stepIndex !== undefined
                    ? { stepIndex: readNonNegativeInteger(payload.stepIndex, 'payload.stepIndex') }
                    : {}),
                ...(payload.stepId ? { stepId: readString(payload.stepId, 'payload.stepId') } : {}),
                ...(payload.stepKind ? { stepKind: readEnumValue(payload.stepKind, 'payload.stepKind', flowStepKinds) } : {}),
            } satisfies FlowCancelledLifecycleEventPayload,
        };
    }

    return {
        id,
        kind,
        flowDefinitionId,
        flowInstanceId,
        at,
        payload: {
            completedStepCount: readNonNegativeInteger(payload.completedStepCount, 'payload.completedStepCount'),
            status: 'completed',
        } satisfies FlowCompletedLifecycleEventPayload,
    };
}

export const flowDefinitionRecordSchema = createParser(parseFlowDefinitionRecord);
export const flowInstanceRecordSchema = createParser(parseFlowInstanceRecord);
export const flowLifecycleEventSchema = createParser(parseFlowLifecycleEvent);
export const flowDefinitionListInputSchema = createParser(parseFlowDefinitionListInput);
export const flowDefinitionGetInputSchema = createParser(parseFlowDefinitionGetInput);
export const flowDefinitionCreateInputSchema = createParser(parseFlowDefinitionCreateInput);
export const flowDefinitionUpdateInputSchema = createParser(parseFlowDefinitionUpdateInput);
export const flowDefinitionDeleteInputSchema = createParser(parseFlowDefinitionDeleteInput);
export const flowInstanceListInputSchema = createParser(parseFlowInstanceListInput);
export const flowInstanceGetInputSchema = createParser(parseFlowInstanceGetInput);
export const flowDefinitionViewSchema = createParser(parseFlowDefinitionView);
export const flowInstanceViewSchema = createParser(parseFlowInstanceView);
