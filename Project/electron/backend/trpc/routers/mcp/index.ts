import { mcpByServerInputSchema } from '@/app/backend/runtime/contracts';
import { mcpStore } from '@/app/backend/persistence/stores';
import { runtimeEventLogService } from '@/app/backend/runtime/services/runtimeEventLog';
import { publicProcedure, router } from '@/app/backend/trpc/init';

export const mcpRouter = router({
    listServers: publicProcedure.query(async () => {
        return { servers: await mcpStore.listServers() };
    }),
    connect: publicProcedure.input(mcpByServerInputSchema).mutation(async ({ input }) => {
        const server = await mcpStore.connect(input.serverId);
        if (!server) {
            return { connected: false as const, reason: 'not_found' as const };
        }

        await runtimeEventLogService.append({
            entityType: 'mcp',
            entityId: server.id,
            eventType: 'mcp.connected',
            payload: {
                server,
            },
        });

        return { connected: true as const, server };
    }),
    disconnect: publicProcedure.input(mcpByServerInputSchema).mutation(async ({ input }) => {
        const server = await mcpStore.disconnect(input.serverId);
        if (!server) {
            return { disconnected: false as const, reason: 'not_found' as const };
        }

        await runtimeEventLogService.append({
            entityType: 'mcp',
            entityId: server.id,
            eventType: 'mcp.disconnected',
            payload: {
                server,
            },
        });

        return { disconnected: true as const, server };
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
