import {
    promptLayerGetSettingsInputSchema,
    promptLayerResetAppGlobalInstructionsInputSchema,
    promptLayerResetProfileGlobalInstructionsInputSchema,
    promptLayerResetTopLevelInstructionsInputSchema,
    promptLayerSetAppGlobalInstructionsInputSchema,
    promptLayerSetProfileGlobalInstructionsInputSchema,
    promptLayerSetTopLevelInstructionsInputSchema,
} from '@/app/backend/runtime/contracts';
import {
    getPromptLayerSettings,
    resetAppGlobalInstructions,
    resetProfileGlobalInstructions,
    resetTopLevelInstructions,
    setAppGlobalInstructions,
    setProfileGlobalInstructions,
    setTopLevelInstructions,
} from '@/app/backend/runtime/services/promptLayers/service';
import { publicProcedure, router } from '@/app/backend/trpc/init';

export const promptRouter = router({
    getSettings: publicProcedure.input(promptLayerGetSettingsInputSchema).query(async ({ input }) => {
        return {
            settings: await getPromptLayerSettings(input.profileId),
        };
    }),
    setAppGlobalInstructions: publicProcedure
        .input(promptLayerSetAppGlobalInstructionsInputSchema)
        .mutation(async ({ input }) => {
            return {
                settings: await setAppGlobalInstructions(input),
            };
        }),
    resetAppGlobalInstructions: publicProcedure
        .input(promptLayerResetAppGlobalInstructionsInputSchema)
        .mutation(async ({ input }) => {
            return {
                settings: await resetAppGlobalInstructions(input.profileId),
            };
        }),
    setProfileGlobalInstructions: publicProcedure
        .input(promptLayerSetProfileGlobalInstructionsInputSchema)
        .mutation(async ({ input }) => {
            return {
                settings: await setProfileGlobalInstructions(input),
            };
        }),
    resetProfileGlobalInstructions: publicProcedure
        .input(promptLayerResetProfileGlobalInstructionsInputSchema)
        .mutation(async ({ input }) => {
            return {
                settings: await resetProfileGlobalInstructions(input.profileId),
            };
        }),
    setTopLevelInstructions: publicProcedure
        .input(promptLayerSetTopLevelInstructionsInputSchema)
        .mutation(async ({ input }) => {
            return {
                settings: await setTopLevelInstructions(input),
            };
        }),
    resetTopLevelInstructions: publicProcedure
        .input(promptLayerResetTopLevelInstructionsInputSchema)
        .mutation(async ({ input }) => {
            return {
                settings: await resetTopLevelInstructions(input),
            };
        }),
});
