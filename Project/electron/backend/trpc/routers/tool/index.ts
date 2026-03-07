import { toolStore } from '@/app/backend/persistence/stores';
import { toolInvokeInputSchema } from '@/app/backend/runtime/contracts';
import { toolExecutionService } from '@/app/backend/runtime/services/toolExecution/service';
import { publicProcedure, router } from '@/app/backend/trpc/init';

export const toolRouter = router({
    list: publicProcedure.query(async () => {
        const tools = await toolStore.list();
        return {
            tools: tools.map((tool) => ({
                ...tool,
                availability: 'available' as const,
            })),
        };
    }),
    invoke: publicProcedure.input(toolInvokeInputSchema).mutation(async ({ input }) => {
        return toolExecutionService.invoke(input);
    }),
});
