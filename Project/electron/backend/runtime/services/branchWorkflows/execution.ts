import type { EntityId, FlowDefinitionRecord } from '@/app/backend/runtime/contracts';
import { flowExecutionService } from '@/app/backend/runtime/services/flows/executionService';
import { normalizeFlowDefinition } from '@/app/backend/runtime/services/flows/lifecycle';
import { flowService } from '@/app/backend/runtime/services/flows/service';

export type BranchWorkflowExecutionResult =
    | {
          status: 'not_requested';
          flowDefinitionId?: string;
          flowInstanceId?: string;
      }
    | {
          status: 'succeeded';
          flowDefinitionId: string;
          flowInstanceId: string;
      }
    | {
          status: 'approval_required';
          requestId: EntityId<'perm'>;
          message: string;
          flowDefinitionId: string;
          flowInstanceId: string;
      }
    | {
          status: 'failed';
          message: string;
          flowDefinitionId: string;
          flowInstanceId: string;
      };

export class BranchWorkflowExecutionService {
    async executeBranchWorkflow(input: {
        profileId: string;
        workspaceFingerprint: string;
        sourceBranchWorkflowId: string;
        sandboxId?: EntityId<'sb'>;
        flowDefinition: FlowDefinitionRecord;
    }): Promise<BranchWorkflowExecutionResult> {
        const persistedDefinition = await flowService.upsertBranchWorkflowAdapterDefinition({
            profileId: input.profileId,
            workspaceFingerprint: input.workspaceFingerprint,
            sourceBranchWorkflowId: input.sourceBranchWorkflowId,
            flowDefinition: normalizeFlowDefinition(input.flowDefinition),
        });

        const flowExecution = await flowExecutionService.startPersistedDefinition({
            profileId: input.profileId,
            flowDefinition: persistedDefinition,
            executionContext: {
                workspaceFingerprint: input.workspaceFingerprint,
                ...(input.sandboxId ? { sandboxId: input.sandboxId } : {}),
            },
        });

        return flowExecution.match(
            (flowInstance) => {
                if (flowInstance.instance.status === 'completed') {
                    return {
                        status: 'succeeded' as const,
                        flowDefinitionId: persistedDefinition.definition.id,
                        flowInstanceId: flowInstance.instance.id,
                    };
                }

                if (
                    flowInstance.instance.status === 'approval_required' &&
                    flowInstance.awaitingApproval?.kind === 'tool_permission' &&
                    flowInstance.awaitingApproval.permissionRequestId
                ) {
                    return {
                        status: 'approval_required' as const,
                        requestId: flowInstance.awaitingApproval.permissionRequestId,
                        message: flowInstance.awaitingApproval.reason,
                        flowDefinitionId: persistedDefinition.definition.id,
                        flowInstanceId: flowInstance.instance.id,
                    };
                }

                return {
                    status: 'failed' as const,
                    message:
                        flowInstance.lastErrorMessage ??
                        'Branch workflow execution did not complete successfully in this slice.',
                    flowDefinitionId: persistedDefinition.definition.id,
                    flowInstanceId: flowInstance.instance.id,
                };
            },
            (error) => {
                throw new Error(
                    `Branch workflow flow "${persistedDefinition.definition.id}" failed to start: ${error.message}`
                );
            }
        );
    }
}

export const branchWorkflowExecutionService = new BranchWorkflowExecutionService();
