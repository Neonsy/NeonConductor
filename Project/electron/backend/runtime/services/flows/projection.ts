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
    executionContext?: FlowInstanceView['executionContext'];
    currentStep?: FlowInstanceView['currentStep'];
    awaitingApproval?: FlowInstanceView['awaitingApproval'];
    availableActions: FlowInstanceView['availableActions'];
    lastErrorMessage?: FlowInstanceView['lastErrorMessage'];
    retrySourceFlowInstanceId?: FlowInstanceView['retrySourceFlowInstanceId'];
    originKind: FlowInstanceView['originKind'];
    workspaceFingerprint?: string;
    sourceBranchWorkflowId?: string;
}): FlowInstanceView {
    return {
        instance: input.instance,
        definitionSnapshot: input.definitionSnapshot,
        lifecycleEvents: input.lifecycleEvents,
        ...(input.executionContext ? { executionContext: input.executionContext } : {}),
        ...(input.currentStep ? { currentStep: input.currentStep } : {}),
        ...(input.awaitingApproval ? { awaitingApproval: input.awaitingApproval } : {}),
        availableActions: input.availableActions,
        ...(input.lastErrorMessage ? { lastErrorMessage: input.lastErrorMessage } : {}),
        ...(input.retrySourceFlowInstanceId
            ? { retrySourceFlowInstanceId: input.retrySourceFlowInstanceId }
            : {}),
        originKind: input.originKind,
        ...(input.workspaceFingerprint ? { workspaceFingerprint: input.workspaceFingerprint } : {}),
        ...(input.sourceBranchWorkflowId ? { sourceBranchWorkflowId: input.sourceBranchWorkflowId } : {}),
    };
}
