import type { ToolInvokeInput } from '@/app/backend/runtime/contracts';
import { resolveEffectivePermissionPolicy } from '@/app/backend/runtime/services/permissions/policyResolver';
import type { ResolvedToolDefinition } from '@/app/backend/runtime/services/toolExecution/types';

export async function resolveToolPolicy(input: {
    request: ToolInvokeInput;
    definition: ResolvedToolDefinition;
}) {
    return resolveEffectivePermissionPolicy({
        profileId: input.request.profileId,
        resource: input.definition.resource,
        topLevelTab: input.request.topLevelTab,
        modeKey: input.request.modeKey,
        toolDefaultPolicy: input.definition.tool.permissionPolicy,
        ...(input.request.workspaceFingerprint
            ? { workspaceFingerprint: input.request.workspaceFingerprint }
            : {}),
    });
}
