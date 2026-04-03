import { flowStore } from '@/app/backend/persistence/stores';
import type { FlowInstancePersistenceRecord, PermissionRecord } from '@/app/backend/persistence/types';
import type {
    FlowCancelInput,
    FlowDefinitionView,
    FlowExecutionContext,
    FlowInstanceRecord,
    FlowInstanceView,
    FlowResumeInput,
    FlowRetryInput,
    FlowStartInput,
    FlowStepDefinition,
} from '@/app/backend/runtime/contracts';
import { errOp, okOp, type OperationalResult } from '@/app/backend/runtime/services/common/operationalError';
import { activeFlowExecutionRegistry } from '@/app/backend/runtime/services/flows/activeExecutionRegistry';
import { appendFlowLifecycleEvent } from '@/app/backend/runtime/services/flows/events';
import { executeFlowLegacyCommandStep } from '@/app/backend/runtime/services/flows/legacyCommandExecutor';

import {
    createFlowApprovalRequiredLifecycleEvent,
    createFlowCancelledLifecycleEvent,
    createFlowCompletedLifecycleEvent,
    createFlowFailedLifecycleEvent,
    createFlowStartedLifecycleEvent,
    createFlowStepCompletedLifecycleEvent,
    createFlowStepStartedLifecycleEvent,
} from '@/shared/flowLifecycle';

function readCurrentStep(record: FlowInstancePersistenceRecord): FlowStepDefinition | undefined {
    return record.definitionSnapshot.steps[record.instance.currentStepIndex];
}

function delay(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function resolveExecutionContext(input: {
    flowDefinition: FlowDefinitionView;
    executionContext?: FlowExecutionContext;
}): FlowExecutionContext | undefined {
    const workspaceFingerprint =
        input.executionContext?.workspaceFingerprint ?? input.flowDefinition.workspaceFingerprint ?? undefined;
    const sandboxId = input.executionContext?.sandboxId;

    if (!workspaceFingerprint && !sandboxId) {
        return undefined;
    }

    return {
        ...(workspaceFingerprint ? { workspaceFingerprint } : {}),
        ...(sandboxId ? { sandboxId } : {}),
    };
}

function clearAwaitingApprovalState(instance: FlowInstanceRecord): FlowInstanceRecord {
    const rest = { ...instance };
    delete rest.awaitingApprovalKind;
    delete rest.awaitingApprovalStepIndex;
    delete rest.awaitingApprovalStepId;
    delete rest.awaitingPermissionRequestId;

    return rest;
}

export class FlowExecutionService {
    async startInstance(
        input: FlowStartInput
    ): Promise<OperationalResult<{ found: false } | { found: true; flowInstance: FlowInstanceView }>> {
        const flowDefinition = await flowStore.getCanonicalDefinitionById(input.profileId, input.flowDefinitionId);
        if (!flowDefinition) {
            return okOp({ found: false });
        }
        if (!flowDefinition.definition.enabled) {
            return errOp('invalid_input', 'Disabled flows cannot be executed.');
        }

        const flowInstance = await this.startPersistedDefinition({
            profileId: input.profileId,
            flowDefinition: {
                definition: flowDefinition.definition,
                originKind: flowDefinition.originKind,
            },
            ...(input.executionContext ? { executionContext: input.executionContext } : {}),
        });

        return flowInstance.match(
            (value) =>
                okOp({
                    found: true,
                    flowInstance: value,
                }),
            (error) => errOp(error.code, error.message, error)
        );
    }

    async startPersistedDefinition(input: {
        profileId: string;
        flowDefinition: FlowDefinitionView;
        executionContext?: FlowExecutionContext;
        retrySourceFlowInstanceId?: string;
    }): Promise<OperationalResult<FlowInstanceView>> {
        const resolvedExecutionContext = resolveExecutionContext(input);
        const persistedInstance = await flowStore.createFlowInstance({
            profileId: input.profileId,
            flowDefinitionId: input.flowDefinition.definition.id,
            definitionSnapshot: input.flowDefinition.definition,
            ...(resolvedExecutionContext ? { executionContext: resolvedExecutionContext } : {}),
            ...(input.retrySourceFlowInstanceId
                ? { retrySourceFlowInstanceId: input.retrySourceFlowInstanceId }
                : {}),
        });
        if (!persistedInstance) {
            return errOp('flow_not_found', `Flow definition "${input.flowDefinition.definition.id}" was not found.`);
        }

        return this.executePersistedInstance({
            profileId: input.profileId,
            record: persistedInstance,
        });
    }

    async resumeInstance(
        input: FlowResumeInput
    ): Promise<OperationalResult<{ found: false } | { found: true; flowInstance: FlowInstanceView }>> {
        const record = await flowStore.getFlowInstanceById(input.profileId, input.flowInstanceId);
        if (!record) {
            return okOp({ found: false });
        }
        if (
            record.instance.status !== 'approval_required' ||
            record.instance.awaitingApprovalKind !== 'flow_gate' ||
            record.instance.awaitingApprovalStepIndex !== input.expectedStepIndex ||
            record.instance.awaitingApprovalStepId !== input.expectedStepId
        ) {
            return errOp('invalid_input', 'Flow instance is not waiting on the requested flow-gate approval state.');
        }

        const flowInstance = await this.executePersistedInstance({
            profileId: input.profileId,
            record,
            resumeFlowGate: true,
        });

        return flowInstance.match(
            (value) =>
                okOp({
                    found: true,
                    flowInstance: value,
                }),
            (error) => errOp(error.code, error.message, error)
        );
    }

    async cancelInstance(
        input: FlowCancelInput
    ): Promise<OperationalResult<{ found: false } | { found: true; flowInstance: FlowInstanceView }>> {
        const record = await flowStore.getFlowInstanceById(input.profileId, input.flowInstanceId);
        if (!record) {
            return okOp({ found: false });
        }
        if (!['queued', 'running', 'approval_required'].includes(record.instance.status)) {
            return errOp('invalid_input', 'Only queued, running, or approval-required flow instances can be cancelled.');
        }

        const activeExecution = activeFlowExecutionRegistry.cancel(record.instance.id);
        if (activeExecution) {
            return okOp({
                found: true,
                flowInstance: await this.waitForCancelledView(input.profileId, record.instance.id),
            });
        }

        const currentStep = readCurrentStep(record);
        const cancelled = await this.markCancelled({
            profileId: input.profileId,
            record,
            reason: 'Flow execution was cancelled.',
            ...(currentStep ? { step: currentStep, stepIndex: record.instance.currentStepIndex } : {}),
        });

        return okOp({
            found: true,
            flowInstance: cancelled,
        });
    }

    async retryInstance(
        input: FlowRetryInput
    ): Promise<OperationalResult<{ found: false } | { found: true; flowInstance: FlowInstanceView }>> {
        const record = await flowStore.getFlowInstanceById(input.profileId, input.flowInstanceId);
        if (!record) {
            return okOp({ found: false });
        }
        if (!['failed', 'cancelled'].includes(record.instance.status)) {
            return errOp('invalid_input', 'Only failed or cancelled flow instances can be retried.');
        }

        const flowInstance = await this.startPersistedDefinition({
            profileId: input.profileId,
            flowDefinition: {
                definition: record.definitionSnapshot,
                originKind: record.originKind,
                ...(record.workspaceFingerprint ? { workspaceFingerprint: record.workspaceFingerprint } : {}),
                ...(record.sourceBranchWorkflowId
                    ? { sourceBranchWorkflowId: record.sourceBranchWorkflowId }
                    : {}),
            },
            ...(record.instance.executionContext ? { executionContext: record.instance.executionContext } : {}),
            retrySourceFlowInstanceId: record.instance.id,
        });

        return flowInstance.match(
            (value) =>
                okOp({
                    found: true,
                    flowInstance: value,
                }),
            (error) => errOp(error.code, error.message, error)
        );
    }

    async handlePermissionResolution(input: { profileId: string; request: PermissionRecord }): Promise<void> {
        if (!input.request.flowInstanceId) {
            return;
        }

        const record = await flowStore.getFlowInstanceById(input.profileId, input.request.flowInstanceId);
        if (
            !record ||
            record.instance.status !== 'approval_required' ||
            record.instance.awaitingApprovalKind !== 'tool_permission' ||
            record.instance.awaitingPermissionRequestId !== input.request.id
        ) {
            return;
        }

        if (input.request.decision === 'granted') {
            const resumed = await this.executePersistedInstance({
                profileId: input.profileId,
                record,
            });
            resumed.match(
                () => undefined,
                (error) => {
                    throw new Error(
                        `Permission-approved flow instance "${record.instance.id}" could not resume: ${error.message}`
                    );
                }
            );
            return;
        }

        if (input.request.decision === 'denied') {
            const currentStep = readCurrentStep(record);
            if (!currentStep) {
                return;
            }
            const commandText = input.request.commandText ? ` "${input.request.commandText}"` : '';
            await this.markFailed({
                profileId: input.profileId,
                record,
                message: `Flow command approval was denied for${commandText}.`,
                step: currentStep,
                stepIndex: record.instance.currentStepIndex,
            });
        }
    }

    private async executePersistedInstance(input: {
        profileId: string;
        record: FlowInstancePersistenceRecord;
        resumeFlowGate?: boolean;
    }): Promise<OperationalResult<FlowInstanceView>> {
        const controller = activeFlowExecutionRegistry.begin(input.record.instance.id);
        if (!controller) {
            return errOp('invalid_input', 'Flow instance is already executing.');
        }

        let record = input.record;

        try {
            if (record.instance.status === 'queued') {
                record = await this.writeStarted(input.profileId, record);
            }

            while (record.instance.currentStepIndex < record.definitionSnapshot.steps.length) {
                if (controller.signal.aborted) {
                    return okOp(
                        await this.markCancelled({
                            profileId: input.profileId,
                            record,
                            reason: 'Flow execution was cancelled.',
                            ...(readCurrentStep(record)
                                ? {
                                      step: readCurrentStep(record) as FlowStepDefinition,
                                      stepIndex: record.instance.currentStepIndex,
                                  }
                                : {}),
                        })
                    );
                }

                const stepIndex = record.instance.currentStepIndex;
                const step = record.definitionSnapshot.steps[stepIndex];
                if (!step) {
                    break;
                }

                const isResumingApprovalStep =
                    record.instance.status === 'approval_required' &&
                    record.instance.awaitingApprovalStepIndex === stepIndex &&
                    record.instance.awaitingApprovalStepId === step.id;

                if (!isResumingApprovalStep) {
                    record = await this.writeStepStarted(input.profileId, record, stepIndex, step);
                }

                if (step.kind === 'approval_gate') {
                    if (isResumingApprovalStep) {
                        if (record.instance.awaitingApprovalKind !== 'flow_gate' || !input.resumeFlowGate) {
                            return errOp(
                                'invalid_input',
                                'Flow instance is waiting on explicit flow-gate approval and must be resumed directly.'
                            );
                        }

                        record = await this.writeStepCompleted(
                            input.profileId,
                            record,
                            stepIndex,
                            step,
                            stepIndex + 1
                        );
                        continue;
                    }

                    return okOp(
                        await this.writeApprovalRequired({
                            profileId: input.profileId,
                            record,
                            stepIndex,
                            step,
                            approvalKind: 'flow_gate',
                            reason: 'Flow requires explicit approval before continuing.',
                        })
                    );
                }

                if (step.kind === 'legacy_command') {
                    if (isResumingApprovalStep && record.instance.awaitingApprovalKind !== 'tool_permission') {
                        return errOp(
                            'invalid_input',
                            'Flow instance is blocked on a different approval kind than the current legacy-command step.'
                        );
                    }

                    const execution = await executeFlowLegacyCommandStep({
                        profileId: input.profileId,
                        flowInstanceId: record.instance.id,
                        stepIndex,
                        step,
                        ...(record.instance.executionContext
                            ? { executionContext: record.instance.executionContext }
                            : {}),
                        signal: controller.signal,
                    });

                    if (execution.kind === 'approval_required') {
                        return okOp(
                            await this.writeApprovalRequired({
                                profileId: input.profileId,
                                record,
                                stepIndex,
                                step,
                                approvalKind: 'tool_permission',
                                reason: execution.message,
                                permissionRequestId: execution.request.id,
                            })
                        );
                    }

                    if (execution.kind === 'cancelled') {
                        return okOp(
                            await this.markCancelled({
                                profileId: input.profileId,
                                record,
                                reason: execution.reason,
                                step,
                                stepIndex,
                            })
                        );
                    }

                    if (execution.kind === 'failed') {
                        return okOp(
                            await this.markFailed({
                                profileId: input.profileId,
                                record,
                                message: execution.message,
                                step,
                                stepIndex,
                            })
                        );
                    }

                    record = await this.writeStepCompleted(input.profileId, record, stepIndex, step, stepIndex + 1);
                    continue;
                }

                return okOp(
                    await this.markFailed({
                        profileId: input.profileId,
                        record,
                        message: `Flow step kind "${step.kind}" is not executable in Execute Flow Slice 3.`,
                        step,
                        stepIndex,
                    })
                );
            }

            return okOp(await this.writeCompleted(input.profileId, record));
        } finally {
            activeFlowExecutionRegistry.finish(input.record.instance.id);
        }
    }

    private async writeStarted(profileId: string, record: FlowInstancePersistenceRecord): Promise<FlowInstancePersistenceRecord> {
        const event = createFlowStartedLifecycleEvent({
            flowDefinitionId: record.definitionSnapshot.id,
            flowInstanceId: record.instance.id,
            triggerKind: record.definitionSnapshot.triggerKind,
            stepCount: record.definitionSnapshot.steps.length,
            ...(record.instance.retrySourceFlowInstanceId
                ? { retrySourceFlowInstanceId: record.instance.retrySourceFlowInstanceId }
                : {}),
        });

        return this.persistInstanceSnapshot(profileId, record, {
            ...record.instance,
            status: 'running',
            startedAt: event.at,
        }, event);
    }

    private async writeStepStarted(
        profileId: string,
        record: FlowInstancePersistenceRecord,
        stepIndex: number,
        step: FlowStepDefinition
    ): Promise<FlowInstancePersistenceRecord> {
        const event = createFlowStepStartedLifecycleEvent({
            flowDefinitionId: record.definitionSnapshot.id,
            flowInstanceId: record.instance.id,
            stepIndex,
            stepId: step.id,
            stepKind: step.kind,
        });

        return this.persistInstanceSnapshot(profileId, record, {
            ...record.instance,
            status: 'running',
            currentStepIndex: stepIndex,
            startedAt: record.instance.startedAt ?? event.at,
        }, event);
    }

    private async writeStepCompleted(
        profileId: string,
        record: FlowInstancePersistenceRecord,
        stepIndex: number,
        step: FlowStepDefinition,
        nextStepIndex: number
    ): Promise<FlowInstancePersistenceRecord> {
        const event = createFlowStepCompletedLifecycleEvent({
            flowDefinitionId: record.definitionSnapshot.id,
            flowInstanceId: record.instance.id,
            stepIndex,
            stepId: step.id,
            stepKind: step.kind,
        });

        return this.persistInstanceSnapshot(profileId, record, {
            ...clearAwaitingApprovalState(record.instance),
            status: 'running',
            currentStepIndex: nextStepIndex,
        }, event);
    }

    private async writeApprovalRequired(input: {
        profileId: string;
        record: FlowInstancePersistenceRecord;
        stepIndex: number;
        step: FlowStepDefinition;
        approvalKind: 'flow_gate' | 'tool_permission';
        reason: string;
        permissionRequestId?: PermissionRecord['id'];
    }): Promise<FlowInstanceView> {
        const event = createFlowApprovalRequiredLifecycleEvent({
            flowDefinitionId: input.record.definitionSnapshot.id,
            flowInstanceId: input.record.instance.id,
            stepIndex: input.stepIndex,
            stepId: input.step.id,
            stepKind: input.step.kind,
            reason: input.reason,
            approvalKind: input.approvalKind,
            ...(input.permissionRequestId ? { permissionRequestId: input.permissionRequestId } : {}),
        });

        await this.persistInstanceSnapshot(input.profileId, input.record, {
            ...input.record.instance,
            status: 'approval_required',
            currentStepIndex: input.stepIndex,
            awaitingApprovalKind: input.approvalKind,
            awaitingApprovalStepIndex: input.stepIndex,
            awaitingApprovalStepId: input.step.id,
            ...(input.approvalKind === 'tool_permission' && input.permissionRequestId
                ? { awaitingPermissionRequestId: input.permissionRequestId }
                : {}),
            startedAt: input.record.instance.startedAt ?? event.at,
        }, event);

        return this.requireFlowInstanceView(input.profileId, input.record.instance.id);
    }

    private async writeCompleted(profileId: string, record: FlowInstancePersistenceRecord): Promise<FlowInstanceView> {
        const event = createFlowCompletedLifecycleEvent({
            flowDefinitionId: record.definitionSnapshot.id,
            flowInstanceId: record.instance.id,
            completedStepCount: record.definitionSnapshot.steps.length,
        });

        await this.persistInstanceSnapshot(profileId, record, {
            ...clearAwaitingApprovalState(record.instance),
            status: 'completed',
            currentStepIndex: record.definitionSnapshot.steps.length,
            finishedAt: event.at,
        }, event);

        return this.requireFlowInstanceView(profileId, record.instance.id);
    }

    private async markFailed(input: {
        profileId: string;
        record: FlowInstancePersistenceRecord;
        message: string;
        step: FlowStepDefinition;
        stepIndex: number;
    }): Promise<FlowInstanceView> {
        const event = createFlowFailedLifecycleEvent({
            flowDefinitionId: input.record.definitionSnapshot.id,
            flowInstanceId: input.record.instance.id,
            errorMessage: input.message,
            stepIndex: input.stepIndex,
            stepId: input.step.id,
            stepKind: input.step.kind,
        });

        await this.persistInstanceSnapshot(input.profileId, input.record, {
            ...clearAwaitingApprovalState(input.record.instance),
            status: 'failed',
            currentStepIndex: input.stepIndex,
            lastErrorMessage: input.message,
            finishedAt: event.at,
        }, event);

        return this.requireFlowInstanceView(input.profileId, input.record.instance.id);
    }

    private async markCancelled(input: {
        profileId: string;
        record: FlowInstancePersistenceRecord;
        reason: string;
        step?: FlowStepDefinition;
        stepIndex?: number;
    }): Promise<FlowInstanceView> {
        const event = createFlowCancelledLifecycleEvent({
            flowDefinitionId: input.record.definitionSnapshot.id,
            flowInstanceId: input.record.instance.id,
            reason: input.reason,
            ...(input.step ? { stepId: input.step.id, stepKind: input.step.kind } : {}),
            ...(input.stepIndex !== undefined ? { stepIndex: input.stepIndex } : {}),
        });

        await this.persistInstanceSnapshot(input.profileId, input.record, {
            ...clearAwaitingApprovalState(input.record.instance),
            status: 'cancelled',
            ...(input.stepIndex !== undefined ? { currentStepIndex: input.stepIndex } : {}),
            finishedAt: event.at,
        }, event);

        return this.requireFlowInstanceView(input.profileId, input.record.instance.id);
    }

    private async persistInstanceSnapshot(
        profileId: string,
        record: FlowInstancePersistenceRecord,
        nextInstance: FlowInstanceRecord,
        event:
            | ReturnType<typeof createFlowStartedLifecycleEvent>
            | ReturnType<typeof createFlowStepStartedLifecycleEvent>
            | ReturnType<typeof createFlowStepCompletedLifecycleEvent>
            | ReturnType<typeof createFlowApprovalRequiredLifecycleEvent>
            | ReturnType<typeof createFlowFailedLifecycleEvent>
            | ReturnType<typeof createFlowCancelledLifecycleEvent>
            | ReturnType<typeof createFlowCompletedLifecycleEvent>
    ): Promise<FlowInstancePersistenceRecord> {
        await appendFlowLifecycleEvent(event);

        const updated = await flowStore.updateFlowInstance({
            profileId,
            flowInstanceId: record.instance.id,
            status: nextInstance.status,
            currentStepIndex: nextInstance.currentStepIndex,
            ...(nextInstance.executionContext ? { executionContext: nextInstance.executionContext } : {}),
            awaitingApprovalKind: nextInstance.awaitingApprovalKind ?? null,
            awaitingApprovalStepIndex: nextInstance.awaitingApprovalStepIndex ?? null,
            awaitingApprovalStepId: nextInstance.awaitingApprovalStepId ?? null,
            awaitingPermissionRequestId: nextInstance.awaitingPermissionRequestId ?? null,
            lastErrorMessage: nextInstance.lastErrorMessage ?? null,
            retrySourceFlowInstanceId: nextInstance.retrySourceFlowInstanceId ?? null,
            ...(nextInstance.startedAt ? { startedAt: nextInstance.startedAt } : {}),
            ...(nextInstance.finishedAt ? { finishedAt: nextInstance.finishedAt } : {}),
        });
        if (!updated) {
            throw new Error(`Persisted flow instance "${record.instance.id}" was not found.`);
        }

        return updated;
    }

    private async requireFlowInstanceView(profileId: string, flowInstanceId: string): Promise<FlowInstanceView> {
        const flowInstance = await flowStore.getFlowInstanceViewById(profileId, flowInstanceId);
        if (!flowInstance) {
            throw new Error(`Persisted flow instance "${flowInstanceId}" was not found.`);
        }

        return flowInstance;
    }

    private async waitForCancelledView(profileId: string, flowInstanceId: string): Promise<FlowInstanceView> {
        for (let attempt = 0; attempt < 120; attempt += 1) {
            const flowInstance = await flowStore.getFlowInstanceViewById(profileId, flowInstanceId);
            if (flowInstance?.instance.status === 'cancelled') {
                return flowInstance;
            }
            await delay(25);
        }

        throw new Error(`Timed out while waiting for flow instance "${flowInstanceId}" to cancel.`);
    }
}

export const flowExecutionService = new FlowExecutionService();
