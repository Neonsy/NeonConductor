import {
    promptLayerCreateCustomModeInputSchema,
    promptLayerDeleteCustomModeInputSchema,
    promptLayerExportCustomModeInputSchema,
    promptLayerGetCustomModeInputSchema,
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
    promptLayerUpdateCustomModeInputSchema,
} from '@/app/backend/runtime/contracts';
import {
    createCustomMode,
    deleteCustomMode,
    exportCustomMode,
    getCustomMode,
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
    updateCustomMode,
} from '@/app/backend/runtime/services/promptLayers/service';
import { publicProcedure, router } from '@/app/backend/trpc/init';
import { raiseMappedTrpcError, toTrpcError } from '@/app/backend/trpc/trpcErrorMap';

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
                settings: (await setBuiltInModePrompt(input)).match(
                    (value) => value,
                    (error) => raiseMappedTrpcError(error, toTrpcError)
                ),
            };
        }),
    resetBuiltInModePrompt: publicProcedure
        .input(promptLayerResetBuiltInModePromptInputSchema)
        .mutation(async ({ input }) => {
            return {
                settings: (await resetBuiltInModePrompt(input)).match(
                    (value) => value,
                    (error) => raiseMappedTrpcError(error, toTrpcError)
                ),
            };
        }),
    getCustomMode: publicProcedure.input(promptLayerGetCustomModeInputSchema).query(async ({ input }) => {
        return (await getCustomMode(input)).match(
            (value) => value,
            (error) => raiseMappedTrpcError(error, toTrpcError)
        );
    }),
    createCustomMode: publicProcedure.input(promptLayerCreateCustomModeInputSchema).mutation(async ({ input }) => {
        return {
            settings: (await createCustomMode(input)).match(
                (value) => value,
                (error) => raiseMappedTrpcError(error, toTrpcError)
            ),
        };
    }),
    updateCustomMode: publicProcedure.input(promptLayerUpdateCustomModeInputSchema).mutation(async ({ input }) => {
        return {
            settings: (await updateCustomMode(input)).match(
                (value) => value,
                (error) => raiseMappedTrpcError(error, toTrpcError)
            ),
        };
    }),
    deleteCustomMode: publicProcedure.input(promptLayerDeleteCustomModeInputSchema).mutation(async ({ input }) => {
        return {
            settings: (await deleteCustomMode(input)).match(
                (value) => value,
                (error) => raiseMappedTrpcError(error, toTrpcError)
            ),
        };
    }),
    exportCustomMode: publicProcedure.input(promptLayerExportCustomModeInputSchema).mutation(async ({ input }) => {
        return (await exportCustomMode(input)).match(
            (value) => value,
            (error) => raiseMappedTrpcError(error, toTrpcError)
        );
    }),
    importCustomMode: publicProcedure.input(promptLayerImportCustomModeInputSchema).mutation(async ({ input }) => {
        return {
            settings: (await importCustomMode(input)).match(
                (value) => value,
                (error) => raiseMappedTrpcError(error, toTrpcError)
            ),
        };
    }),
});
