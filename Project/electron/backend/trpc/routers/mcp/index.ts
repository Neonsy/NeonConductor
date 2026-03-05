import { mcpStore } from '@/app/backend/persistence/stores';
import type { McpServerRecord } from '@/app/backend/persistence/types';
import { mcpByServerInputSchema } from '@/app/backend/runtime/contracts';
import { runtimeEventLogService } from '@/app/backend/runtime/services/runtimeEventLog';
import { publicProcedure, router } from '@/app/backend/trpc/init';

interface UnsupportedMcpMutationEnvelope {
    reason: 'not_implemented';
    code: 'not_implemented';
    message: string;
    unsupportedReason: string;
    server: McpServerRecord;
}

function createUnsupportedMcpMutationEnvelope(
    server: McpServerRecord,
    action: 'connect' | 'disconnect'
): UnsupportedMcpMutationEnvelope {
    const unsupportedReason = 'MCP server lifecycle mutation is not implemented yet.';
    return {
        reason: 'not_implemented',
        code: 'not_implemented',
        message: `MCP ${action} is not implemented yet for server "${server.id}".`,
        unsupportedReason,
        server,
    };
}

export const mcpRouter = router({
    listServers: publicProcedure.query(async () => {
        return { servers: await mcpStore.listServers() };
    }),
    connect: publicProcedure.input(mcpByServerInputSchema).mutation(async ({ input }) => {
        const server = await mcpStore.getServer(input.serverId);
        if (!server) {
            return { connected: false, reason: 'not_found' as const };
        }

        await runtimeEventLogService.append({
            entityType: 'mcp',
            entityId: server.id,
            eventType: 'mcp.lifecycle.unsupported',
            payload: {
                serverId: server.id,
                action: 'connect',
                reason: 'not_implemented',
                message: 'MCP connect is not implemented yet.',
            },
        });

        return {
            connected: false,
            ...createUnsupportedMcpMutationEnvelope(server, 'connect'),
        };
    }),
    disconnect: publicProcedure.input(mcpByServerInputSchema).mutation(async ({ input }) => {
        const server = await mcpStore.getServer(input.serverId);
        if (!server) {
            return { disconnected: false, reason: 'not_found' as const };
        }

        await runtimeEventLogService.append({
            entityType: 'mcp',
            entityId: server.id,
            eventType: 'mcp.lifecycle.unsupported',
            payload: {
                serverId: server.id,
                action: 'disconnect',
                reason: 'not_implemented',
                message: 'MCP disconnect is not implemented yet.',
            },
        });

        return {
            disconnected: false,
            ...createUnsupportedMcpMutationEnvelope(server, 'disconnect'),
        };
    }),
    authStatus: publicProcedure.input(mcpByServerInputSchema).query(async ({ input }) => {
        const server = await mcpStore.getServer(input.serverId);
        if (!server) {
            return { found: false as const };
        }

        return {
            found: true as const,
            serverId: server.id,
            authMode: server.authMode,
            authState: server.authState,
            connectionState: server.connectionState,
        };
    }),
});
