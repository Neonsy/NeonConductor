import {
    memoryCreateInputSchema,
    memoryDisableInputSchema,
    memoryListInputSchema,
    memorySupersedeInputSchema,
} from '@/app/backend/runtime/contracts';
import { memoryService } from '@/app/backend/runtime/services/memory/service';
import { publicProcedure, router } from '@/app/backend/trpc/init';
import { toTrpcError, unwrapResultOrThrow } from '@/app/backend/trpc/trpcErrorMap';

export const memoryRouter = router({
    list: publicProcedure.input(memoryListInputSchema).query(async ({ input }) => {
        return {
            memories: await memoryService.listMemories(input),
        };
    }),
    create: publicProcedure.input(memoryCreateInputSchema).mutation(async ({ input }) => {
        const result = await memoryService.createMemory(input);
        return {
            memory: unwrapResultOrThrow(result, toTrpcError),
        };
    }),
    disable: publicProcedure.input(memoryDisableInputSchema).mutation(async ({ input }) => {
        const result = await memoryService.disableMemory(input);
        return {
            memory: unwrapResultOrThrow(result, toTrpcError),
        };
    }),
    supersede: publicProcedure.input(memorySupersedeInputSchema).mutation(async ({ input }) => {
        const result = await memoryService.supersedeMemory(input);
        return unwrapResultOrThrow(result, toTrpcError);
    }),
});
