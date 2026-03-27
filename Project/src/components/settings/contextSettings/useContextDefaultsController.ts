import { setResolvedContextStateCache } from '@/web/components/context/contextStateCache';
import {
    resolveContextGlobalDraft,
    type ContextGlobalDraft,
} from '@/web/components/settings/contextSettingsDrafts';
import { createFailClosedAsyncAction } from '@/web/lib/async/createFailClosedAsyncAction';
import { PROGRESSIVE_QUERY_OPTIONS } from '@/web/lib/query/progressiveQueryOptions';
import { trpc } from '@/web/trpc/client';

import type { ResolvedContextStateInput } from '@/shared/contracts/types/context';

interface ContextDefaultsControllerInput {
    previewQueryInput: ResolvedContextStateInput | undefined;
    setFeedback: (tone: 'success' | 'error' | 'info', message: string | undefined) => void;
}

export function useContextDefaultsController(input: ContextDefaultsControllerInput) {
    const utils = trpc.useUtils();
    const globalSettingsQuery = trpc.context.getGlobalSettings.useQuery(undefined, PROGRESSIVE_QUERY_OPTIONS);
    const globalDraft = resolveContextGlobalDraft({
        settings: globalSettingsQuery.data?.settings,
        draft: undefined,
    });

    const setGlobalSettingsMutation = trpc.context.setGlobalSettings.useMutation({
        onSuccess: ({ settings, resolvedState }) => {
            input.setFeedback('success', 'Saved global context defaults.');
            utils.context.getGlobalSettings.setData(undefined, { settings });
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
        draft: globalDraft,
        draftKey: `${String(globalDraft.enabled)}:${globalDraft.percent}`,
        isSaving: setGlobalSettingsMutation.isPending,
        save: createFailClosedAsyncAction(async (draft: ContextGlobalDraft) => {
            const percent = Number(draft.percent);
            if (!Number.isInteger(percent) || percent < 1 || percent > 100) {
                input.setFeedback('error', 'Global compact threshold must be an integer between 1 and 100.');
                return;
            }

            const previewInput = input.previewQueryInput ? { preview: input.previewQueryInput } : {};
            await setGlobalSettingsMutation.mutateAsync({
                enabled: draft.enabled,
                mode: 'percent',
                percent,
                ...previewInput,
            });
        }),
    };
}
