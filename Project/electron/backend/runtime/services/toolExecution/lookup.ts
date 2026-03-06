import { toolStore } from '@/app/backend/persistence/stores';
import type { ResolvedToolDefinition } from '@/app/backend/runtime/services/toolExecution/types';

export async function findToolById(toolId: string): Promise<ResolvedToolDefinition | null> {
    const tools = await toolStore.list();
    const tool = tools.find((candidate) => candidate.id === toolId);
    if (!tool) {
        return null;
    }

    return {
        tool,
        resource: `tool:${tool.id}`,
    };
}
