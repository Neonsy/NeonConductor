import { appContextSettingsStore, profileContextSettingsStore } from '@/app/backend/persistence/stores';
import {
    compactSessionInputSchema,
    profileInputSchema,
    resolvedContextStateInputSchema,
    setContextGlobalSettingsInputSchema,
    setContextProfileSettingsInputSchema,
} from '@/app/backend/runtime/contracts';
import { sessionContextService } from '@/app/backend/runtime/services/context/sessionContextService';
import { publicProcedure, router } from '@/app/backend/trpc/init';
import { toTrpcError } from '@/app/backend/trpc/trpcErrorMap';

export const contextRouter = router({
    getGlobalSettings: publicProcedure.query(async () => {
        return {
            settings: await appContextSettingsStore.get(),
        };
    }),
    setGlobalSettings: publicProcedure.input(setContextGlobalSettingsInputSchema).mutation(async ({ input }) => {
        const settings = await appContextSettingsStore.set(input);
        const resolvedState = input.preview
            ? await sessionContextService.getResolvedState({
                  profileId: input.preview.profileId,
                  providerId: input.preview.providerId,
                  modelId: input.preview.modelId,
              })
            : undefined;

        return {
            settings,
            ...(resolvedState ? { resolvedState } : {}),
        };
    }),
    getProfileSettings: publicProcedure.input(profileInputSchema).query(async ({ input }) => {
        return {
            settings: await profileContextSettingsStore.get(input.profileId),
        };
    }),
    setProfileSettings: publicProcedure.input(setContextProfileSettingsInputSchema).mutation(async ({ input }) => {
        const settings = await profileContextSettingsStore.set(input);
        const resolvedState = input.preview
            ? await sessionContextService.getResolvedState({
                  profileId: input.preview.profileId,
                  providerId: input.preview.providerId,
                  modelId: input.preview.modelId,
              })
            : undefined;

        return {
            settings,
            ...(resolvedState ? { resolvedState } : {}),
        };
    }),
    getResolvedState: publicProcedure.input(resolvedContextStateInputSchema).query(async ({ input }) => {
        if (!input.sessionId || !input.topLevelTab || !input.modeKey) {
            return sessionContextService.getResolvedState({
                profileId: input.profileId,
                providerId: input.providerId,
                modelId: input.modelId,
            });
        }

        const resolvedState = await sessionContextService.getResolvedStateForExecutionTarget({
            profileId: input.profileId,
            sessionId: input.sessionId,
            providerId: input.providerId,
            modelId: input.modelId,
            topLevelTab: input.topLevelTab,
            modeKey: input.modeKey,
            ...(input.workspaceFingerprint ? { workspaceFingerprint: input.workspaceFingerprint } : {}),
        });
        return resolvedState.match(
            (value) => value,
            (error) => {
                throw toTrpcError(error);
            }
        );
    }),
    compactSession: publicProcedure.input(compactSessionInputSchema).mutation(async ({ input }) => {
        const result = await sessionContextService.compactSession({
            profileId: input.profileId,
            sessionId: input.sessionId,
            providerId: input.providerId,
            modelId: input.modelId,
            source: 'manual',
        });
        const compacted = result.match(
            (value) => value,
            (error) => {
                throw toTrpcError(error);
            }
        );
        const resolvedStateResult = await sessionContextService.getResolvedStateForExecutionTarget({
            profileId: input.profileId,
            sessionId: input.sessionId,
            providerId: input.providerId,
            modelId: input.modelId,
            topLevelTab: input.topLevelTab,
            modeKey: input.modeKey,
            ...(input.workspaceFingerprint ? { workspaceFingerprint: input.workspaceFingerprint } : {}),
        });
        const resolvedState = resolvedStateResult.match(
            (value) => value,
            (error) => {
                throw toTrpcError(error);
            }
        );

        return {
            ...compacted,
            resolvedState,
        };
    }),
});
