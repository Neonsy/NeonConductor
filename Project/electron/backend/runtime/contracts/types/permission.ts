import type { PermissionPolicy } from '@/app/backend/runtime/contracts/enums';
import type { EntityId } from '@/app/backend/runtime/contracts/ids';

export interface PermissionRequestInput {
    policy: PermissionPolicy;
    resource: string;
    rationale?: string;
}

export interface PermissionDecisionInput {
    requestId: EntityId<'perm'>;
}

export interface ToolInvokeInput {
    toolId: string;
    args?: Record<string, unknown>;
}

export interface McpByServerInput {
    serverId: string;
}
