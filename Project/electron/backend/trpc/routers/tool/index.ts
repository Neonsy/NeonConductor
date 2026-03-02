import { toolInvokeInputSchema } from '@/app/backend/runtime/contracts';
import { getRuntimeState } from '@/app/backend/runtime/state';
import { publicProcedure, router } from '@/app/backend/trpc/init';

export const toolRouter = router({
    list: publicProcedure.query(() => {
        const state = getRuntimeState();
        return { tools: state.tools };
    }),
    invoke: publicProcedure.input(toolInvokeInputSchema).mutation(({ input }) => {
        const state = getRuntimeState();
        const tool = state.tools.find((item) => item.id === input.toolId);
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
