import { flowStore } from '@/app/backend/persistence/stores';
import type {
    FlowExecutionContext,
    FlowDefinitionCreateInput,
    FlowDefinitionDeleteInput,
    FlowDefinitionRecord,
    FlowDefinitionUpdateInput,
    FlowDefinitionView,
    FlowInstanceRecord,
    FlowInstanceStatus,
    FlowInstanceView,
    FlowLifecycleEvent,
    FlowStepDefinition,
} from '@/app/backend/runtime/contracts';
import { errOp, okOp, type OperationalResult } from '@/app/backend/runtime/services/common/operationalError';
import {
    advanceFlowInstanceProjection,
    buildFlowLifecycleEvents,
    createFlowInstanceProjection,
    normalizeFlowDefinition,
} from '@/app/backend/runtime/services/flows/lifecycle';
import { buildFlowDefinitionView, buildFlowInstanceView } from '@/app/backend/runtime/services/flows/projection';

export interface FlowLifecycleProjection {
    definition: FlowDefinitionRecord;
    instance: FlowInstanceRecord;
}

export class FlowService {
    normalizeFlowDefinition(definition: FlowDefinitionRecord): FlowDefinitionRecord {
        return normalizeFlowDefinition(definition);
    }

    createFlowInstance(definition: FlowDefinitionRecord, id?: string): FlowInstanceRecord {
        return createFlowInstanceProjection({
            flowDefinition: this.normalizeFlowDefinition(definition),
            ...(id ? { id } : {}),
        });
    }

    advanceFlowInstance(
        flowInstance: FlowInstanceRecord,
        input: {
            status: FlowInstanceStatus;
            currentStepIndex?: number;
            startedAt?: string;
            finishedAt?: string;
        }
    ): FlowInstanceRecord {
        return advanceFlowInstanceProjection({
            flowInstance,
            status: input.status,
            ...(input.currentStepIndex !== undefined ? { currentStepIndex: input.currentStepIndex } : {}),
            ...(input.startedAt ? { startedAt: input.startedAt } : {}),
            ...(input.finishedAt ? { finishedAt: input.finishedAt } : {}),
        });
    }

    buildLifecycleProjection(input: FlowLifecycleProjection) {
        return buildFlowLifecycleEvents({
            flowDefinition: input.definition,
            flowInstance: input.instance,
        });
    }

    createLegacyCommandFlowDefinition(input: {
        id: string;
        label: string;
        command: string;
        description?: string;
        enabled?: boolean;
        createdAt?: string;
        updatedAt?: string;
    }): FlowDefinitionRecord {
        const now = new Date().toISOString();
        return this.normalizeFlowDefinition({
            id: input.id,
            label: input.label,
            ...(input.description ? { description: input.description } : {}),
            enabled: input.enabled ?? true,
            triggerKind: 'manual',
            steps: [
                {
                    kind: 'legacy_command',
                    id: `${input.id}:step_1`,
                    label: input.label,
                    command: input.command,
                } satisfies FlowStepDefinition,
            ],
            createdAt: input.createdAt ?? now,
            updatedAt: input.updatedAt ?? now,
        });
    }

    async listDefinitions(profileId: string): Promise<FlowDefinitionView[]> {
        return (await flowStore.listCanonicalDefinitions(profileId)).map((definition) =>
            buildFlowDefinitionView({
                definition: definition.definition,
                originKind: definition.originKind,
            })
        );
    }

    async getDefinition(profileId: string, flowDefinitionId: string): Promise<FlowDefinitionView | null> {
        const definition = await flowStore.getCanonicalDefinitionById(profileId, flowDefinitionId);
        if (!definition) {
            return null;
        }

        return buildFlowDefinitionView({
            definition: definition.definition,
            originKind: definition.originKind,
        });
    }

    async createDefinition(input: FlowDefinitionCreateInput): Promise<OperationalResult<FlowDefinitionView>> {
        const created = await flowStore.createCanonicalDefinition(input);
        return okOp(
            buildFlowDefinitionView({
                definition: created.definition,
                originKind: created.originKind,
            })
        );
    }

    async updateDefinition(input: FlowDefinitionUpdateInput): Promise<OperationalResult<FlowDefinitionView | null>> {
        const updated = await flowStore.updateCanonicalDefinition(input);
        if (!updated) {
            return okOp(null);
        }

        return okOp(
            buildFlowDefinitionView({
                definition: updated.definition,
                originKind: updated.originKind,
            })
        );
    }

    async deleteDefinition(input: FlowDefinitionDeleteInput): Promise<OperationalResult<boolean>> {
        if (!input.confirm) {
            return errOp('invalid_input', 'Deleting a flow definition requires explicit confirmation.');
        }

        const deleted = await flowStore.deleteCanonicalDefinition(input.profileId, input.flowDefinitionId);
        if (deleted === 'not_found') {
            return okOp(false);
        }
        if (deleted === 'has_instances') {
            return errOp(
                'invalid_input',
                'Flow definitions with persisted instances cannot be deleted in this slice.'
            );
        }

        return okOp(true);
    }

    async listInstances(profileId: string): Promise<FlowInstanceView[]> {
        return flowStore.listFlowInstanceViews(profileId);
    }

    async getInstance(profileId: string, flowInstanceId: string): Promise<FlowInstanceView | null> {
        return flowStore.getFlowInstanceViewById(profileId, flowInstanceId);
    }

    async upsertBranchWorkflowAdapterDefinition(input: {
        profileId: string;
        workspaceFingerprint: string;
        sourceBranchWorkflowId: string;
        flowDefinition: FlowDefinitionRecord;
    }): Promise<FlowDefinitionView> {
        const persistedDefinition = await flowStore.upsertBranchWorkflowAdapterDefinition(input);
        return buildFlowDefinitionView({
            definition: persistedDefinition.definition,
            originKind: persistedDefinition.originKind,
            ...(persistedDefinition.workspaceFingerprint
                ? { workspaceFingerprint: persistedDefinition.workspaceFingerprint }
                : {}),
            ...(persistedDefinition.sourceBranchWorkflowId
                ? { sourceBranchWorkflowId: persistedDefinition.sourceBranchWorkflowId }
                : {}),
        });
    }

    async createPersistedInstance(input: {
        profileId: string;
        flowDefinition: FlowDefinitionView;
        executionContext?: FlowExecutionContext;
        retrySourceFlowInstanceId?: string;
    }): Promise<FlowInstanceView> {
        const persistedInstance = await flowStore.createFlowInstance({
            profileId: input.profileId,
            flowDefinitionId: input.flowDefinition.definition.id,
            definitionSnapshot: input.flowDefinition.definition,
            ...(input.executionContext ? { executionContext: input.executionContext } : {}),
            ...(input.retrySourceFlowInstanceId
                ? { retrySourceFlowInstanceId: input.retrySourceFlowInstanceId }
                : {}),
        });
        if (!persistedInstance) {
            throw new Error(`Persisted flow definition "${input.flowDefinition.definition.id}" was not found.`);
        }

        return buildFlowInstanceView({
            instance: persistedInstance.instance,
            definitionSnapshot: persistedInstance.definitionSnapshot,
            lifecycleEvents: [],
            ...(persistedInstance.instance.executionContext
                ? { executionContext: persistedInstance.instance.executionContext }
                : {}),
            availableActions: {
                canResume: false,
                canCancel: true,
                canRetry: false,
            },
            ...(persistedInstance.instance.retrySourceFlowInstanceId
                ? { retrySourceFlowInstanceId: persistedInstance.instance.retrySourceFlowInstanceId }
                : {}),
            originKind: persistedInstance.originKind,
            ...(persistedInstance.workspaceFingerprint
                ? { workspaceFingerprint: persistedInstance.workspaceFingerprint }
                : {}),
            ...(persistedInstance.sourceBranchWorkflowId
                ? { sourceBranchWorkflowId: persistedInstance.sourceBranchWorkflowId }
                : {}),
        });
    }

    async persistLifecycleEvent(input: {
        profileId: string;
        flowInstanceId: string;
        status: FlowInstanceStatus;
        currentStepIndex: number;
        startedAt?: string;
        finishedAt?: string;
        event?: FlowLifecycleEvent;
    }): Promise<void> {
        if (!input.event) {
            return;
        }

        const updated = await flowStore.recordFlowLifecycleEvent({
            profileId: input.profileId,
            flowInstanceId: input.flowInstanceId,
            event: input.event,
        });
        if (!updated) {
            throw new Error(`Persisted flow instance "${input.flowInstanceId}" was not found.`);
        }
    }
}

export const flowService = new FlowService();
