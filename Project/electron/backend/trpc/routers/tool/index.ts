import { TRPCError } from '@trpc/server';

import { toolStore } from '@/app/backend/persistence/stores';
import {
    toolInvokeInputSchema,
    toolResetBuiltInDescriptionInputSchema,
    toolSetBuiltInDescriptionInputSchema,
} from '@/app/backend/runtime/contracts';
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
    listBuiltInMetadata: publicProcedure.query(async () => {
        return {
            tools: await toolStore.listBuiltInMetadata(),
        };
    }),
    setBuiltInDescription: publicProcedure
        .input(toolSetBuiltInDescriptionInputSchema)
        .mutation(async ({ input }) => {
            try {
                return {
                    tools: await toolStore.setBuiltInDescription(input.toolId, input.description),
                };
            } catch (error) {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: error instanceof Error ? error.message : String(error),
                    cause: error,
                });
            }
        }),
    resetBuiltInDescription: publicProcedure
        .input(toolResetBuiltInDescriptionInputSchema)
        .mutation(async ({ input }) => {
            try {
                return {
                    tools: await toolStore.resetBuiltInDescription(input.toolId),
                };
            } catch (error) {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: error instanceof Error ? error.message : String(error),
                    cause: error,
                });
            }
        }),
    invoke: publicProcedure.input(toolInvokeInputSchema).mutation(async ({ input }) => {
        return toolExecutionService.invoke(input);
    }),
});
