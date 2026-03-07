import { permissionPolicyOverrideStore } from '@/app/backend/persistence/stores';
import type { ExecutionPreset, PermissionPolicy, ToolCapability, TopLevelTab } from '@/app/backend/runtime/contracts';

export interface ResolvedPermissionPolicy {
    policy: PermissionPolicy;
    source: 'mode' | 'workspace_override' | 'profile_override' | 'execution_preset' | 'tool_default';
}

function extractToolIdFromResource(resource: string): string | null {
    if (!resource.startsWith('tool:')) {
        return null;
    }

    const resourceBody = resource.slice('tool:'.length).trim();
    const toolId = resourceBody.split(':', 1)[0]?.trim() ?? '';
    return toolId.length > 0 ? toolId : null;
}

function isMutatingTool(toolId: string): boolean {
    return toolId === 'run_command';
}

function isReadOnlyCapabilitySet(capabilities: ToolCapability[]): boolean {
    return capabilities.length > 0 && capabilities.every((capability) => capability === 'filesystem_read');
}

function resolveModePolicy(
    topLevelTab: TopLevelTab,
    modeKey: string,
    resource: string,
    capabilities: ToolCapability[]
): PermissionPolicy | null {
    const toolId = extractToolIdFromResource(resource);
    if (!toolId) {
        return null;
    }

    if (topLevelTab === 'chat') {
        return 'deny';
    }

    if (modeKey === 'plan') {
        return 'deny';
    }

    if (topLevelTab === 'agent' && modeKey === 'ask') {
        return isMutatingTool(toolId) || !isReadOnlyCapabilitySet(capabilities) ? 'deny' : 'allow';
    }

    return null;
}

function resolvePresetPolicy(input: {
    executionPreset: ExecutionPreset;
    toolDefaultPolicy: PermissionPolicy;
    capabilities: ToolCapability[];
}): PermissionPolicy {
    if (input.executionPreset === 'privacy') {
        return 'ask';
    }

    if (isReadOnlyCapabilitySet(input.capabilities)) {
        return 'allow';
    }

    return input.toolDefaultPolicy;
}

export async function resolveEffectivePermissionPolicy(input: {
    profileId: string;
    resource: string;
    topLevelTab: TopLevelTab;
    modeKey: string;
    executionPreset: ExecutionPreset;
    capabilities: ToolCapability[];
    workspaceFingerprint?: string;
    toolDefaultPolicy: PermissionPolicy;
}): Promise<ResolvedPermissionPolicy> {
    const modePolicy = resolveModePolicy(input.topLevelTab, input.modeKey, input.resource, input.capabilities);
    if (modePolicy) {
        return {
            policy: modePolicy,
            source: 'mode',
        };
    }

    if (input.workspaceFingerprint) {
        const scopeKey = permissionPolicyOverrideStore.toWorkspaceScopeKey(input.workspaceFingerprint);
        const workspaceOverride = await permissionPolicyOverrideStore.get(input.profileId, scopeKey, input.resource);
        if (workspaceOverride) {
            return {
                policy: workspaceOverride.policy,
                source: 'workspace_override',
            };
        }
    }

    const profileOverride = await permissionPolicyOverrideStore.get(
        input.profileId,
        permissionPolicyOverrideStore.toProfileScopeKey(),
        input.resource
    );
    if (profileOverride) {
        return {
            policy: profileOverride.policy,
            source: 'profile_override',
        };
    }

    const presetPolicy = resolvePresetPolicy({
        executionPreset: input.executionPreset,
        toolDefaultPolicy: input.toolDefaultPolicy,
        capabilities: input.capabilities,
    });
    if (presetPolicy !== input.toolDefaultPolicy) {
        return {
            policy: presetPolicy,
            source: 'execution_preset',
        };
    }

    return {
        policy: input.toolDefaultPolicy,
        source: 'tool_default',
    };
}
