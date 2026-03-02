import { mcpByServerInputSchema } from '@/app/backend/runtime/contracts';
import { getRuntimeState } from '@/app/backend/runtime/state';
import { publicProcedure, router } from '@/app/backend/trpc/init';

export const mcpRouter = router({
    listServers: publicProcedure.query(() => {
        const state = getRuntimeState();
        return { servers: [...state.mcpServers.values()] };
    }),
    connect: publicProcedure.input(mcpByServerInputSchema).mutation(({ input }) => {
        const state = getRuntimeState();
        const server = state.mcpServers.get(input.serverId);
        if (!server) {
            return { connected: false as const, reason: 'not_found' as const };
        }

        server.connectionState = 'connected';
        if (server.authMode === 'none') {
            server.authState = 'authenticated';
        }

        return { connected: true as const, server };
    }),
    disconnect: publicProcedure.input(mcpByServerInputSchema).mutation(({ input }) => {
        const state = getRuntimeState();
        const server = state.mcpServers.get(input.serverId);
        if (!server) {
            return { disconnected: false as const, reason: 'not_found' as const };
        }

        server.connectionState = 'disconnected';

        return { disconnected: true as const, server };
    }),
    authStatus: publicProcedure.input(mcpByServerInputSchema).query(({ input }) => {
        const state = getRuntimeState();
        const server = state.mcpServers.get(input.serverId);
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
