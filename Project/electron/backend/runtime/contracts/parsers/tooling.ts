import { topLevelTabs } from '@/app/backend/runtime/contracts/enums';
import {
    createParser,
    readEntityId,
    readEnumValue,
    readObject,
    readOptionalString,
    readProfileId,
    readString,
} from '@/app/backend/runtime/contracts/parsers/helpers';
import type { ToolInvokeInput } from '@/app/backend/runtime/contracts/types';

export function parseToolInvokeInput(input: unknown): ToolInvokeInput {
    const source = readObject(input, 'input');
    const args = source.args;
    const workspaceFingerprint = readOptionalString(source.workspaceFingerprint, 'workspaceFingerprint');
    const sandboxId = source.sandboxId !== undefined ? readEntityId(source.sandboxId, 'sandboxId', 'sb') : undefined;

    return {
        profileId: readProfileId(source),
        toolId: readString(source.toolId, 'toolId'),
        topLevelTab: readEnumValue(source.topLevelTab, 'topLevelTab', topLevelTabs),
        modeKey: readString(source.modeKey, 'modeKey'),
        ...(workspaceFingerprint ? { workspaceFingerprint } : {}),
        ...(sandboxId ? { sandboxId } : {}),
        ...(args !== undefined ? { args: readObject(args, 'args') } : {}),
    };
}

export const toolInvokeInputSchema = createParser(parseToolInvokeInput);

export function parseToolSetBuiltInDescriptionInput(input: unknown): { toolId: string; description: string } {
    const source = readObject(input, 'input');

    return {
        toolId: readString(source.toolId, 'toolId'),
        description: readString(source.description, 'description'),
    };
}

export const toolSetBuiltInDescriptionInputSchema = createParser(parseToolSetBuiltInDescriptionInput);

export function parseToolResetBuiltInDescriptionInput(input: unknown): { toolId: string } {
    const source = readObject(input, 'input');

    return {
        toolId: readString(source.toolId, 'toolId'),
    };
}

export const toolResetBuiltInDescriptionInputSchema = createParser(parseToolResetBuiltInDescriptionInput);
