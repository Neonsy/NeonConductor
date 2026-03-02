import { toolInvokeInputSchema } from '@/app/backend/runtime/contracts';
import { toolStore } from '@/app/backend/persistence/stores';
import { publicProcedure, router } from '@/app/backend/trpc/init';

export const toolRouter = router({
    list: publicProcedure.query(async () => {
        return { tools: await toolStore.list() };
    }),
    invoke: publicProcedure.input(toolInvokeInputSchema).mutation(async ({ input }) => {
        const tools = await toolStore.list();
        const tool = tools.find((item) => item.id === input.toolId);
        if (!tool) {
            return {
                ok: false as const,
                error: 'tool_not_found' as const,
            };
        }

        return {
            ok: true as const,
            toolId: tool.id,
            output: {
                summary: `Stub invocation completed for "${tool.id}".`,
                args: input.args ?? {},
            },
            at: new Date().toISOString(),
        };
    }),
});
