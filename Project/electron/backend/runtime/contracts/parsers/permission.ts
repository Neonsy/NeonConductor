import { permissionPolicies, topLevelTabs } from '@/app/backend/runtime/contracts/enums';
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
    PermissionDecisionInput,
    PermissionGetEffectivePolicyInput,
    PermissionRequestInput,
    PermissionSetProfileOverrideInput,
    PermissionSetWorkspaceOverrideInput,
} from '@/app/backend/runtime/contracts/types';

export function parsePermissionRequestInput(input: unknown): PermissionRequestInput {
    const source = readObject(input, 'input');
    const rationale = readOptionalString(source.rationale, 'rationale');

    return {
        policy: readEnumValue(source.policy, 'policy', permissionPolicies),
        resource: readString(source.resource, 'resource'),
        ...(rationale ? { rationale } : {}),
    };
}

export function parsePermissionDecisionInput(input: unknown): PermissionDecisionInput {
    const source = readObject(input, 'input');

    return {
        requestId: readEntityId(source.requestId, 'requestId', 'perm'),
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
export const permissionDecisionInputSchema = createParser(parsePermissionDecisionInput);
export const permissionGetEffectivePolicyInputSchema = createParser(parsePermissionGetEffectivePolicyInput);
export const permissionSetProfileOverrideInputSchema = createParser(parsePermissionSetProfileOverrideInput);
export const permissionSetWorkspaceOverrideInputSchema = createParser(parsePermissionSetWorkspaceOverrideInput);
