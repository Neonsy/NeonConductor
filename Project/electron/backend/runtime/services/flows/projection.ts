import type {
    FlowDefinitionView,
    FlowInstanceView,
    FlowLifecycleEvent,
} from '@/app/backend/runtime/contracts';

export function buildFlowDefinitionView(input: FlowDefinitionView): FlowDefinitionView {
    return input;
}

export function buildFlowInstanceView(input: {
    instance: FlowInstanceView['instance'];
    definitionSnapshot: FlowInstanceView['definitionSnapshot'];
    lifecycleEvents: FlowLifecycleEvent[];
    originKind: FlowInstanceView['originKind'];
    workspaceFingerprint?: string;
    sourceBranchWorkflowId?: string;
}): FlowInstanceView {
    return {
        instance: input.instance,
        definitionSnapshot: input.definitionSnapshot,
        lifecycleEvents: input.lifecycleEvents,
        originKind: input.originKind,
        ...(input.workspaceFingerprint ? { workspaceFingerprint: input.workspaceFingerprint } : {}),
        ...(input.sourceBranchWorkflowId ? { sourceBranchWorkflowId: input.sourceBranchWorkflowId } : {}),
    };
}
