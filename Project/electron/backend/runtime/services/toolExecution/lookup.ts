import { toolStore } from '@/app/backend/persistence/stores';
import { mcpService } from '@/app/backend/runtime/services/mcp/service';
import type { ResolvedToolDefinition } from '@/app/backend/runtime/services/toolExecution/types';

export async function findToolById(toolId: string): Promise<ResolvedToolDefinition | null> {
    const tools = await toolStore.list();
    const tool = tools.find((candidate) => candidate.id === toolId);
    if (tool) {
        return {
            tool,
            resource: `tool:${tool.id}`,
            source: 'native',
        };
    }

    const mcpTool = await mcpService.findRuntimeToolById(toolId);
    if (!mcpTool) {
        return null;
    }

    return {
        tool: {
            id: mcpTool.id,
            label: `${mcpTool.serverId}/${mcpTool.toolName}`,
            description: mcpTool.description,
            permissionPolicy: 'ask',
            capabilities: ['mcp'],
            requiresWorkspace: false,
            allowsExternalPaths: false,
            allowsIgnoredPaths: false,
        },
        resource: mcpTool.resource,
        source: 'mcp',
        mcpServerId: mcpTool.serverId,
        mcpToolName: mcpTool.toolName,
    };
}
