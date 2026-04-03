import type { WorkflowRoutingTargetKey } from '@/shared/contracts';
import type { PlanPlanningDepth } from '@/shared/contracts/types/plan';
import type { ModeCompatibilityRequirements } from '@/shared/modeRouting';

export interface WorkflowRoutingCompatibilityRequirements extends ModeCompatibilityRequirements {
    requiresReasoning: boolean;
}

export function resolvePlanningWorkflowRoutingTarget(
    planningDepth: PlanPlanningDepth | undefined
): WorkflowRoutingTargetKey {
    return planningDepth === 'advanced' ? 'planning_advanced' : 'planning';
}

export function getWorkflowRoutingTargetLabel(targetKey: WorkflowRoutingTargetKey): string {
    return targetKey === 'planning' ? 'Planning' : 'Advanced planning';
}

export function resolveWorkflowRoutingCompatibilityRequirements(
    targetKey: WorkflowRoutingTargetKey
): WorkflowRoutingCompatibilityRequirements {
    return {
        requiresNativeTools: true,
        allowsImageAttachments: true,
        requiresReasoning: targetKey === 'planning_advanced',
        runtimeProfile: 'read_only_agent',
    };
}

export function getWorkflowRoutingCompatibilityReason(targetKey: WorkflowRoutingTargetKey): string | undefined {
    return targetKey === 'planning_advanced'
        ? 'Advanced planning routing requires a reasoning-capable model.'
        : undefined;
}
