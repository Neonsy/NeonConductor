import {
    permissionPolicies,
    permissionResolutions,
    permissionScopeKinds,
    topLevelTabs,
} from '@/app/backend/runtime/contracts/enums';
import {
    createParser,
    readEntityId,
    readEnumValue,
    readObject,
    readOptionalString,
    readProfileId,
    readString,
} from '@/app/backend/runtime/contracts/parsers/helpers';
import type {
    PermissionApprovalCandidate,
    PermissionGetEffectivePolicyInput,
    PermissionRequestInput,
    PermissionResolveInput,
    PermissionSetProfileOverrideInput,
    PermissionSetWorkspaceOverrideInput,
} from '@/app/backend/runtime/contracts/types';

function parseApprovalCandidate(input: unknown, index: number): PermissionApprovalCandidate {
    const source = readObject(input, `approvalCandidates[${String(index)}]`);
    const detail = readOptionalString(source.detail, `approvalCandidates[${String(index)}].detail`);

    return {
        label: readString(source.label, `approvalCandidates[${String(index)}].label`),
        resource: readString(source.resource, `approvalCandidates[${String(index)}].resource`),
        ...(detail ? { detail } : {}),
    };
}

export function parsePermissionRequestInput(input: unknown): PermissionRequestInput {
    const source = readObject(input, 'input');
    const rationale = readOptionalString(source.rationale, 'rationale');
    const workspaceFingerprint = readOptionalString(source.workspaceFingerprint, 'workspaceFingerprint');
    const commandText = readOptionalString(source.commandText, 'commandText');
    const summary = readObject(source.summary, 'summary');
    const approvalCandidates = Array.isArray(source.approvalCandidates)
        ? source.approvalCandidates.map((candidate, index) => parseApprovalCandidate(candidate, index))
        : undefined;

    return {
        profileId: readProfileId(source),
        policy: readEnumValue(source.policy, 'policy', permissionPolicies),
        resource: readString(source.resource, 'resource'),
        toolId: readString(source.toolId, 'toolId'),
        scopeKind: readEnumValue(source.scopeKind, 'scopeKind', permissionScopeKinds),
        summary: {
            title: readString(summary.title, 'summary.title'),
            detail: readString(summary.detail, 'summary.detail'),
        },
        ...(workspaceFingerprint ? { workspaceFingerprint } : {}),
        ...(commandText ? { commandText } : {}),
        ...(approvalCandidates && approvalCandidates.length > 0 ? { approvalCandidates } : {}),
        ...(rationale ? { rationale } : {}),
    };
}

export function parsePermissionResolveInput(input: unknown): PermissionResolveInput {
    const source = readObject(input, 'input');
    const selectedApprovalResource = readOptionalString(source.selectedApprovalResource, 'selectedApprovalResource');

    return {
        profileId: readProfileId(source),
        requestId: readEntityId(source.requestId, 'requestId', 'perm'),
        resolution: readEnumValue(source.resolution, 'resolution', permissionResolutions),
        ...(selectedApprovalResource ? { selectedApprovalResource } : {}),
    };
}

export function parsePermissionGetEffectivePolicyInput(input: unknown): PermissionGetEffectivePolicyInput {
    const source = readObject(input, 'input');
    const workspaceFingerprint = readOptionalString(source.workspaceFingerprint, 'workspaceFingerprint');

    return {
        profileId: readProfileId(source),
        resource: readString(source.resource, 'resource'),
        topLevelTab: readEnumValue(source.topLevelTab, 'topLevelTab', topLevelTabs),
        modeKey: readString(source.modeKey, 'modeKey'),
        ...(workspaceFingerprint ? { workspaceFingerprint } : {}),
    };
}

export function parsePermissionSetProfileOverrideInput(input: unknown): PermissionSetProfileOverrideInput {
    const source = readObject(input, 'input');

    return {
        profileId: readProfileId(source),
        resource: readString(source.resource, 'resource'),
        policy: readEnumValue(source.policy, 'policy', permissionPolicies),
    };
}

export function parsePermissionSetWorkspaceOverrideInput(input: unknown): PermissionSetWorkspaceOverrideInput {
    const source = readObject(input, 'input');

    return {
        profileId: readProfileId(source),
        workspaceFingerprint: readString(source.workspaceFingerprint, 'workspaceFingerprint'),
        resource: readString(source.resource, 'resource'),
        policy: readEnumValue(source.policy, 'policy', permissionPolicies),
    };
}

export const permissionRequestInputSchema = createParser(parsePermissionRequestInput);
export const permissionResolveInputSchema = createParser(parsePermissionResolveInput);
export const permissionGetEffectivePolicyInputSchema = createParser(parsePermissionGetEffectivePolicyInput);
export const permissionSetProfileOverrideInputSchema = createParser(parsePermissionSetProfileOverrideInput);
export const permissionSetWorkspaceOverrideInputSchema = createParser(parsePermissionSetWorkspaceOverrideInput);
