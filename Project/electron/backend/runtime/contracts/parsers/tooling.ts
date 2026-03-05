import { topLevelTabs } from '@/app/backend/runtime/contracts/enums';
import {
    createParser,
    readEnumValue,
    readObject,
    readOptionalString,
    readProfileId,
    readString,
} from '@/app/backend/runtime/contracts/parsers/helpers';
import type { McpByServerInput, ToolInvokeInput } from '@/app/backend/runtime/contracts/types';

export function parseToolInvokeInput(input: unknown): ToolInvokeInput {
    const source = readObject(input, 'input');
    const args = source.args;
    const workspaceFingerprint = readOptionalString(source.workspaceFingerprint, 'workspaceFingerprint');

    return {
        profileId: readProfileId(source),
        toolId: readString(source.toolId, 'toolId'),
        topLevelTab: readEnumValue(source.topLevelTab, 'topLevelTab', topLevelTabs),
        modeKey: readString(source.modeKey, 'modeKey'),
        ...(workspaceFingerprint ? { workspaceFingerprint } : {}),
        ...(args !== undefined ? { args: readObject(args, 'args') } : {}),
    };
}

export function parseMcpByServerInput(input: unknown): McpByServerInput {
    const source = readObject(input, 'input');

    return {
        serverId: readString(source.serverId, 'serverId'),
    };
}

export const toolInvokeInputSchema = createParser(parseToolInvokeInput);
export const mcpByServerInputSchema = createParser(parseMcpByServerInput);
