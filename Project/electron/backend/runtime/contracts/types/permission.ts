import type { PermissionPolicy } from '@/app/backend/runtime/contracts/enums';
import type { TopLevelTab } from '@/app/backend/runtime/contracts/enums';
import type { EntityId } from '@/app/backend/runtime/contracts/ids';
import type { ProfileInput } from '@/app/backend/runtime/contracts/types/common';

export interface PermissionRequestInput {
    policy: PermissionPolicy;
    resource: string;
    rationale?: string;
}

export interface PermissionDecisionInput {
    requestId: EntityId<'perm'>;
}

export interface PermissionGetEffectivePolicyInput extends ProfileInput {
    resource: string;
    topLevelTab: TopLevelTab;
    modeKey: string;
    workspaceFingerprint?: string;
}

export interface PermissionSetProfileOverrideInput extends ProfileInput {
    resource: string;
    policy: PermissionPolicy;
}

export interface PermissionSetWorkspaceOverrideInput extends ProfileInput {
    workspaceFingerprint: string;
    resource: string;
    policy: PermissionPolicy;
}

export interface ToolInvokeInput extends ProfileInput {
    toolId: string;
    args?: Record<string, unknown>;
    topLevelTab: TopLevelTab;
    modeKey: string;
    workspaceFingerprint?: string;
}

export interface McpByServerInput {
    serverId: string;
}
