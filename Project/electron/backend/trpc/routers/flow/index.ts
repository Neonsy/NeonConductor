import {
    flowDefinitionCreateInputSchema,
    flowDefinitionDeleteInputSchema,
    flowDefinitionGetInputSchema,
    flowDefinitionListInputSchema,
    flowDefinitionUpdateInputSchema,
    flowInstanceGetInputSchema,
    flowInstanceListInputSchema,
} from '@/app/backend/runtime/contracts';
import { flowService } from '@/app/backend/runtime/services/flows/service';
import { publicProcedure, router } from '@/app/backend/trpc/init';
import { raiseMappedTrpcError, toTrpcError } from '@/app/backend/trpc/trpcErrorMap';

export const flowRouter = router({
    listDefinitions: publicProcedure.input(flowDefinitionListInputSchema).query(async ({ input }) => {
        return {
            flowDefinitions: await flowService.listDefinitions(input.profileId),
        };
    }),
    getDefinition: publicProcedure.input(flowDefinitionGetInputSchema).query(async ({ input }) => {
        const flowDefinition = await flowService.getDefinition(input.profileId, input.flowDefinitionId);
        return flowDefinition
            ? {
                  found: true as const,
                  flowDefinition,
              }
            : {
                  found: false as const,
              };
    }),
    createDefinition: publicProcedure.input(flowDefinitionCreateInputSchema).mutation(async ({ input }) => {
        return {
            flowDefinition: (await flowService.createDefinition(input)).match(
                (value) => value,
                (error) => raiseMappedTrpcError(error, toTrpcError)
            ),
        };
    }),
    updateDefinition: publicProcedure.input(flowDefinitionUpdateInputSchema).mutation(async ({ input }) => {
        const flowDefinition = (await flowService.updateDefinition(input)).match(
            (value) => value,
            (error) => raiseMappedTrpcError(error, toTrpcError)
        );

        return flowDefinition
            ? {
                  updated: true as const,
                  flowDefinition,
              }
            : {
                  updated: false as const,
                  reason: 'not_found' as const,
              };
    }),
    deleteDefinition: publicProcedure.input(flowDefinitionDeleteInputSchema).mutation(async ({ input }) => {
        return {
            deleted: (await flowService.deleteDefinition(input)).match(
                (value) => value,
                (error) => raiseMappedTrpcError(error, toTrpcError)
            ),
        };
    }),
    listInstances: publicProcedure.input(flowInstanceListInputSchema).query(async ({ input }) => {
        return {
            flowInstances: await flowService.listInstances(input.profileId),
        };
    }),
    getInstance: publicProcedure.input(flowInstanceGetInputSchema).query(async ({ input }) => {
        const flowInstance = await flowService.getInstance(input.profileId, input.flowInstanceId);
        return flowInstance
            ? {
                  found: true as const,
                  flowInstance,
              }
            : {
                  found: false as const,
              };
    }),
});
