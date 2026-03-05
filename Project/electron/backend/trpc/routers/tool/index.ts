import { toolStore } from '@/app/backend/persistence/stores';
import { toolInvokeInputSchema } from '@/app/backend/runtime/contracts';
import { toolExecutionService } from '@/app/backend/runtime/services/toolExecution/service';
import { publicProcedure, router } from '@/app/backend/trpc/init';

function resolveToolAvailability(toolId: string): {
    availability: 'available' | 'unsupported';
    unsupportedReason?: string;
} {
    if (toolId === 'run_command') {
        return {
            availability: 'unsupported',
            unsupportedReason: 'run_command is currently unavailable in this runtime.',
        };
    }

    return { availability: 'available' };
}

export const toolRouter = router({
    list: publicProcedure.query(async () => {
        const tools = await toolStore.list();
        return {
            tools: tools.map((tool) => ({
                ...tool,
                ...resolveToolAvailability(tool.id),
            })),
        };
    }),
    invoke: publicProcedure.input(toolInvokeInputSchema).mutation(async ({ input }) => {
        return toolExecutionService.invoke(input);
    }),
});
