import type {
    FlowDefinitionOriginKind,
    FlowInstanceStatus,
    FlowTriggerKind,
    TopLevelTab,
    WorkflowCapability,
} from '@/app/backend/runtime/contracts/enums';
import type { ProfileInput } from '@/app/backend/runtime/contracts/types/common';
import type { FlowLifecycleEvent as SharedFlowLifecycleEvent } from '@/shared/flowLifecycle';

export interface FlowLegacyCommandStepDefinition {
    kind: 'legacy_command';
    id: string;
    label: string;
    command: string;
}

export interface FlowModeRunStepDefinition {
    kind: 'mode_run';
    id: string;
    label: string;
    topLevelTab: TopLevelTab;
    modeKey: string;
}

export interface FlowWorkflowStepDefinition {
    kind: 'workflow';
    id: string;
    label: string;
    workflowCapability: WorkflowCapability;
}

export interface FlowApprovalGateStepDefinition {
    kind: 'approval_gate';
    id: string;
    label: string;
}

export type FlowStepDefinition =
    | FlowLegacyCommandStepDefinition
    | FlowModeRunStepDefinition
    | FlowWorkflowStepDefinition
    | FlowApprovalGateStepDefinition;

export interface FlowDefinitionRecord {
    id: string;
    label: string;
    description?: string | undefined;
    enabled: boolean;
    triggerKind: FlowTriggerKind;
    steps: FlowStepDefinition[];
    createdAt: string;
    updatedAt: string;
}

export interface FlowInstanceRecord {
    id: string;
    flowDefinitionId: string;
    status: FlowInstanceStatus;
    currentStepIndex: number;
    startedAt?: string;
    finishedAt?: string;
}

export type FlowLifecycleEvent = SharedFlowLifecycleEvent;

export interface FlowDefinitionView {
    definition: FlowDefinitionRecord;
    originKind: FlowDefinitionOriginKind;
    workspaceFingerprint?: string;
    sourceBranchWorkflowId?: string;
}

export interface FlowInstanceView {
    instance: FlowInstanceRecord;
    definitionSnapshot: FlowDefinitionRecord;
    lifecycleEvents: FlowLifecycleEvent[];
    originKind: FlowDefinitionOriginKind;
    workspaceFingerprint?: string;
    sourceBranchWorkflowId?: string;
}

export type FlowDefinitionListInput = ProfileInput;

export interface FlowDefinitionGetInput extends ProfileInput {
    flowDefinitionId: string;
}

export interface FlowDefinitionCreateInput extends ProfileInput {
    label: string;
    description?: string;
    enabled: boolean;
    triggerKind: FlowTriggerKind;
    steps: FlowStepDefinition[];
}

export interface FlowDefinitionUpdateInput extends ProfileInput {
    flowDefinitionId: string;
    label: string;
    description?: string;
    enabled: boolean;
    triggerKind: FlowTriggerKind;
    steps: FlowStepDefinition[];
}

export interface FlowDefinitionDeleteInput extends ProfileInput {
    flowDefinitionId: string;
    confirm: boolean;
}

export type FlowInstanceListInput = ProfileInput;

export interface FlowInstanceGetInput extends ProfileInput {
    flowInstanceId: string;
}
