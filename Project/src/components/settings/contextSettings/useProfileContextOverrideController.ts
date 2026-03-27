import { setResolvedContextStateCache } from '@/web/components/context/contextStateCache';
import {
    resolveContextGlobalDraft,
    resolveContextProfileDraft,
    type ContextProfileDraft,
} from '@/web/components/settings/contextSettingsDrafts';
import { createFailClosedAsyncAction } from '@/web/lib/async/createFailClosedAsyncAction';
import { PROGRESSIVE_QUERY_OPTIONS } from '@/web/lib/query/progressiveQueryOptions';
import { trpc } from '@/web/trpc/client';

import type { ResolvedContextStateInput } from '@/shared/contracts/types/context';
import type { ResolvedContextState } from '@/shared/contracts/types/context';

interface ProfileContextOverrideControllerInput {
    profileId: string;
    previewQueryInput: ResolvedContextStateInput | undefined;
    resolvedContextState:
        | (ReturnType<typeof trpc.context.getResolvedState.useQuery> & { data: ResolvedContextState | undefined })
        | undefined;
    setFeedback: (tone: 'success' | 'error' | 'info', message: string | undefined) => void;
}

export function useProfileContextOverrideController(input: ProfileContextOverrideControllerInput) {
    const utils = trpc.useUtils();
    const globalSettingsQuery = trpc.context.getGlobalSettings.useQuery(undefined, PROGRESSIVE_QUERY_OPTIONS);
    const profileSettingsQuery = trpc.context.getProfileSettings.useQuery(
        { profileId: input.profileId },
        { enabled: input.profileId.length > 0, ...PROGRESSIVE_QUERY_OPTIONS }
    );
    const globalDraft = resolveContextGlobalDraft({
        settings: globalSettingsQuery.data?.settings,
        draft: undefined,
    });
    const profileDraft = resolveContextProfileDraft({
        profileId: input.profileId,
        inheritedPercent: globalDraft.percent,
        settings: profileSettingsQuery.data?.settings,
        draft: undefined,
    });

    const setProfileSettingsMutation = trpc.context.setProfileSettings.useMutation({
        onSuccess: ({ settings, resolvedState }) => {
            input.setFeedback('success', 'Saved profile context override.');
            utils.context.getProfileSettings.setData({ profileId: input.profileId }, { settings });
            if (resolvedState && input.previewQueryInput) {
                setResolvedContextStateCache({
                    utils,
                    queryInput: input.previewQueryInput,
                    state: resolvedState,
                });
            }
        },
        onError: (error) => {
            input.setFeedback('error', error.message);
        },
    });

    return {
        draft: profileDraft,
        draftKey: [input.profileId, profileDraft.overrideMode, profileDraft.percent, profileDraft.fixedInputTokens].join(
            ':'
        ),
        isSaving: setProfileSettingsMutation.isPending,
        modelLimitsKnown: input.resolvedContextState?.data?.policy.limits.modelLimitsKnown ?? false,
        save: createFailClosedAsyncAction(async (draft: ContextProfileDraft) => {
            const previewInput = input.previewQueryInput ? { preview: input.previewQueryInput } : {};

            if (draft.overrideMode === 'inherit') {
                await setProfileSettingsMutation.mutateAsync({
                    profileId: input.profileId,
                    overrideMode: 'inherit',
                    ...previewInput,
                });
                return;
            }

            if (draft.overrideMode === 'percent') {
                const percent = Number(draft.percent);
                if (!Number.isInteger(percent) || percent < 1 || percent > 100) {
                    input.setFeedback('error', 'Profile compact threshold must be an integer between 1 and 100.');
                    return;
                }

                await setProfileSettingsMutation.mutateAsync({
                    profileId: input.profileId,
                    overrideMode: 'percent',
                    percent,
                    ...previewInput,
                });
                return;
            }

            const fixedInputTokens = Number(draft.fixedInputTokens);
            if (!Number.isInteger(fixedInputTokens) || fixedInputTokens < 1) {
                input.setFeedback('error', 'Fixed input tokens must be a positive integer.');
                return;
            }

            await setProfileSettingsMutation.mutateAsync({
                profileId: input.profileId,
                overrideMode: 'fixed_tokens',
                fixedInputTokens,
                ...previewInput,
            });
        }),
    };
}
