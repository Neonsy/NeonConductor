import { providerStore } from '@/app/backend/persistence/stores';
import type {
    InternalModelRoleDiagnosticRecord,
    InternalModelRoleDiagnostics,
    PlannerTargetDiagnosticRecord,
    RuntimeProviderId,
} from '@/app/backend/runtime/contracts';
import { resolvePlanningWorkflowRoutingRunTarget } from '@/app/backend/runtime/services/plan/workflowRoutingTarget';
import { memoryRetrievalModelService } from '@/app/backend/runtime/services/profile/memoryRetrievalModel';
import { utilityModelService } from '@/app/backend/runtime/services/profile/utilityModel';

import { getWorkflowRoutingTargetLabel } from '@/shared/workflowRouting';

function buildRoleRecord(input: InternalModelRoleDiagnosticRecord): InternalModelRoleDiagnosticRecord {
    return input;
}

export class InternalModelRoleDiagnosticsService {
    async getDiagnostics(profileId: string): Promise<InternalModelRoleDiagnostics> {
        const defaults = await providerStore.getDefaults(profileId);
        const sharedDefaultProviderId =
            typeof defaults.providerId === 'string' ? (defaults.providerId as RuntimeProviderId) : undefined;
        const sharedDefaultModelId = defaults.modelId;

        const [utilityPreference, memoryRetrievalPreference, simplePlannerTarget, advancedPlannerTarget] =
            await Promise.all([
                sharedDefaultProviderId && sharedDefaultModelId
                    ? utilityModelService.resolveUtilityModelTarget({
                          profileId,
                          fallbackProviderId: sharedDefaultProviderId,
                          fallbackModelId: sharedDefaultModelId,
                      })
                    : Promise.resolve(undefined),
                memoryRetrievalModelService.getMemoryRetrievalModelPreference(profileId),
                resolvePlanningWorkflowRoutingRunTarget({
                    profileId,
                    planningDepth: 'simple',
                }),
                resolvePlanningWorkflowRoutingRunTarget({
                    profileId,
                    planningDepth: 'advanced',
                }),
            ]);

        const roles: InternalModelRoleDiagnosticRecord[] = [
            buildRoleRecord({
                role: 'chat',
                label: 'Chat',
                status: sharedDefaultProviderId && sharedDefaultModelId ? 'configured' : 'unconfigured',
                ...(sharedDefaultProviderId ? { providerId: sharedDefaultProviderId } : {}),
                ...(sharedDefaultModelId ? { modelId: sharedDefaultModelId } : {}),
                sourceLabel: 'Shared conversation default',
                ...(sharedDefaultProviderId && sharedDefaultModelId
                    ? {}
                    : { detail: 'No shared default provider/model is available.' }),
            }),
            buildRoleRecord({
                role: 'planner',
                label: 'Planner',
                status: simplePlannerTarget ? 'configured' : 'unconfigured',
                ...(simplePlannerTarget?.providerId ? { providerId: simplePlannerTarget.providerId } : {}),
                ...(simplePlannerTarget?.modelId ? { modelId: simplePlannerTarget.modelId } : {}),
                sourceLabel: simplePlannerTarget ? 'Planning workflow routing' : 'Planner routing unavailable',
                ...(simplePlannerTarget
                    ? {}
                    : { detail: 'No compatible planning target could be resolved for the planner role.' }),
            }),
            buildRoleRecord({
                role: 'apply',
                label: 'Apply',
                status: sharedDefaultProviderId && sharedDefaultModelId ? 'fallback' : 'unconfigured',
                ...(sharedDefaultProviderId ? { providerId: sharedDefaultProviderId } : {}),
                ...(sharedDefaultModelId ? { modelId: sharedDefaultModelId } : {}),
                sourceLabel: 'Shared conversation default fallback',
                detail: 'Runnable agent and worker routing still falls back to the shared default in this slice.',
            }),
            buildRoleRecord({
                role: 'utility',
                label: 'Utility',
                status: utilityPreference?.source === 'utility' ? 'configured' : sharedDefaultProviderId ? 'fallback' : 'unconfigured',
                ...(utilityPreference?.providerId ? { providerId: utilityPreference.providerId } : {}),
                ...(utilityPreference?.modelId ? { modelId: utilityPreference.modelId } : {}),
                sourceLabel:
                    utilityPreference?.source === 'utility'
                        ? 'Saved Utility AI selection'
                        : 'Falls back to the shared conversation default',
            }),
            buildRoleRecord({
                role: 'memory_retrieval',
                label: 'Memory Retrieval',
                status: memoryRetrievalPreference.selection ? 'configured' : 'unconfigured',
                ...(memoryRetrievalPreference.selection?.providerId
                    ? { providerId: memoryRetrievalPreference.selection.providerId }
                    : {}),
                ...(memoryRetrievalPreference.selection?.modelId
                    ? { modelId: memoryRetrievalPreference.selection.modelId }
                    : {}),
                sourceLabel: memoryRetrievalPreference.selection
                    ? 'Saved memory retrieval selection'
                    : 'No memory retrieval model configured',
            }),
            buildRoleRecord({
                role: 'embeddings',
                label: 'Embeddings',
                status: 'unconfigured',
                sourceLabel: 'Read-only diagnostic in this slice',
                detail: 'Embeddings are reserved for a later batch and are not independently configurable yet.',
            }),
            buildRoleRecord({
                role: 'rerank',
                label: 'Rerank',
                status: 'unconfigured',
                sourceLabel: 'Read-only diagnostic in this slice',
                detail: 'Reranking is reserved for a later batch and is not independently configurable yet.',
            }),
        ];

        const plannerTargets: PlannerTargetDiagnosticRecord[] = [
            {
                targetKey: 'planning',
                label: getWorkflowRoutingTargetLabel('planning'),
                status: simplePlannerTarget ? 'configured' : 'unconfigured',
                ...(simplePlannerTarget?.providerId ? { providerId: simplePlannerTarget.providerId } : {}),
                ...(simplePlannerTarget?.modelId ? { modelId: simplePlannerTarget.modelId } : {}),
                sourceLabel: simplePlannerTarget
                    ? simplePlannerTarget.source === 'workflow_routing'
                        ? 'Saved workflow routing'
                        : simplePlannerTarget.source === 'workspace_preference'
                          ? 'Workspace preference fallback'
                          : simplePlannerTarget.source === 'shared_defaults'
                            ? 'Shared default fallback'
                            : 'Compatibility fallback'
                    : 'No planning target resolved',
                resolvedTargetKey: simplePlannerTarget?.resolvedTargetKey ?? 'planning',
                fellBackToPlanning: simplePlannerTarget?.fellBackToPlanning ?? false,
            },
            {
                targetKey: 'planning_advanced',
                label: getWorkflowRoutingTargetLabel('planning_advanced'),
                status: advancedPlannerTarget ? 'configured' : 'unconfigured',
                ...(advancedPlannerTarget?.providerId ? { providerId: advancedPlannerTarget.providerId } : {}),
                ...(advancedPlannerTarget?.modelId ? { modelId: advancedPlannerTarget.modelId } : {}),
                sourceLabel: advancedPlannerTarget
                    ? advancedPlannerTarget.fellBackToPlanning
                        ? 'Saved advanced routing fell back to planning'
                        : advancedPlannerTarget.source === 'workflow_routing'
                          ? 'Saved workflow routing'
                          : advancedPlannerTarget.source === 'workspace_preference'
                            ? 'Workspace preference fallback'
                            : advancedPlannerTarget.source === 'shared_defaults'
                              ? 'Shared default fallback'
                              : 'Compatibility fallback'
                    : 'No advanced planning target resolved',
                resolvedTargetKey: advancedPlannerTarget?.resolvedTargetKey ?? 'planning_advanced',
                fellBackToPlanning: advancedPlannerTarget?.fellBackToPlanning ?? false,
            },
        ];

        return {
            roles,
            plannerTargets,
            updatedAt: new Date().toISOString(),
        };
    }
}

export const internalModelRoleDiagnosticsService = new InternalModelRoleDiagnosticsService();
