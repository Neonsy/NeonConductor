import type { RuntimeProviderId } from '@/shared/contracts';

export const workflowRoutingTargetKeys = ['planning', 'planning_advanced'] as const;

export type WorkflowRoutingTargetKey = (typeof workflowRoutingTargetKeys)[number];

export interface WorkflowRoutingPreferenceLike {
    targetKey: string;
}

export interface WorkflowRoutingPreferenceRecordLike extends WorkflowRoutingPreferenceLike {
    providerId: RuntimeProviderId;
    modelId: string;
}

const workflowRoutingTargetKeySet = new Set<WorkflowRoutingTargetKey>(workflowRoutingTargetKeys);

export function isSupportedWorkflowRoutingTargetKey(value: string): value is WorkflowRoutingTargetKey {
    return workflowRoutingTargetKeySet.has(value as WorkflowRoutingTargetKey);
}

export function findWorkflowRoutingPreference<TRecord extends WorkflowRoutingPreferenceRecordLike>(
    preferences: TRecord[],
    targetKey: WorkflowRoutingTargetKey
): TRecord | undefined {
    return preferences.find((preference) => preference.targetKey === targetKey);
}

export function resolveWorkflowRoutingPreference<TRecord extends WorkflowRoutingPreferenceRecordLike>(
    preferences: TRecord[],
    targetKey: WorkflowRoutingTargetKey
):
    | {
          preference: TRecord;
          resolvedTargetKey: WorkflowRoutingTargetKey;
          fellBackToPlanning: boolean;
      }
    | undefined {
    const directPreference = findWorkflowRoutingPreference(preferences, targetKey);
    if (directPreference) {
        return {
            preference: directPreference,
            resolvedTargetKey: targetKey,
            fellBackToPlanning: false,
        };
    }

    if (targetKey === 'planning_advanced') {
        const planningPreference = findWorkflowRoutingPreference(preferences, 'planning');
        if (planningPreference) {
            return {
                preference: planningPreference,
                resolvedTargetKey: 'planning',
                fellBackToPlanning: true,
            };
        }
    }

    return undefined;
}
