import type { McpByServerInput, ToolInvokeInput } from '@/app/backend/runtime/contracts/types';
import { createParser, readObject, readString } from '@/app/backend/runtime/contracts/parsers/helpers';

export function parseToolInvokeInput(input: unknown): ToolInvokeInput {
    const source = readObject(input, 'input');
    const args = source.args;

    return {
        toolId: readString(source.toolId, 'toolId'),
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
