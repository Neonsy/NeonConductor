import { permissionPolicies } from '@/app/backend/runtime/contracts/enums';
import type { PermissionDecisionInput, PermissionRequestInput } from '@/app/backend/runtime/contracts/types';
import {
    createParser,
    readEntityId,
    readEnumValue,
    readObject,
    readOptionalString,
    readString,
} from '@/app/backend/runtime/contracts/parsers/helpers';

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

export const permissionRequestInputSchema = createParser(parsePermissionRequestInput);
export const permissionDecisionInputSchema = createParser(parsePermissionDecisionInput);
