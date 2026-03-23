import {
    promptLayerExportCustomModeInputSchema,
    promptLayerGetSettingsInputSchema,
    promptLayerImportCustomModeInputSchema,
    promptLayerResetBuiltInModePromptInputSchema,
    promptLayerResetAppGlobalInstructionsInputSchema,
    promptLayerResetProfileGlobalInstructionsInputSchema,
    promptLayerResetTopLevelInstructionsInputSchema,
    promptLayerSetBuiltInModePromptInputSchema,
    promptLayerSetAppGlobalInstructionsInputSchema,
    promptLayerSetProfileGlobalInstructionsInputSchema,
    promptLayerSetTopLevelInstructionsInputSchema,
} from '@/app/backend/runtime/contracts';
import {
    exportCustomMode,
    getPromptLayerSettings,
    importCustomMode,
    resetBuiltInModePrompt,
    resetAppGlobalInstructions,
    resetProfileGlobalInstructions,
    resetTopLevelInstructions,
    setBuiltInModePrompt,
    setAppGlobalInstructions,
    setProfileGlobalInstructions,
    setTopLevelInstructions,
} from '@/app/backend/runtime/services/promptLayers/service';
import { publicProcedure, router } from '@/app/backend/trpc/init';

export const promptRouter = router({
    getSettings: publicProcedure.input(promptLayerGetSettingsInputSchema).query(async ({ input }) => {
        return {
            settings: await getPromptLayerSettings(input.profileId, input.workspaceFingerprint),
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
    setBuiltInModePrompt: publicProcedure
        .input(promptLayerSetBuiltInModePromptInputSchema)
        .mutation(async ({ input }) => {
            return {
                settings: await setBuiltInModePrompt(input),
            };
        }),
    resetBuiltInModePrompt: publicProcedure
        .input(promptLayerResetBuiltInModePromptInputSchema)
        .mutation(async ({ input }) => {
            return {
                settings: await resetBuiltInModePrompt(input),
            };
        }),
    exportCustomMode: publicProcedure.input(promptLayerExportCustomModeInputSchema).mutation(async ({ input }) => {
        return exportCustomMode(input);
    }),
    importCustomMode: publicProcedure.input(promptLayerImportCustomModeInputSchema).mutation(async ({ input }) => {
        return {
            settings: await importCustomMode(input),
        };
    }),
});
