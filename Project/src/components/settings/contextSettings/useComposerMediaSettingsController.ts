import {
    resolveComposerMediaSettingsDraft,
    type ComposerMediaSettingsDraft,
} from '@/web/components/settings/composerMediaSettingsDrafts';
import { createFailClosedAsyncAction } from '@/web/lib/async/createFailClosedAsyncAction';
import { PROGRESSIVE_QUERY_OPTIONS } from '@/web/lib/query/progressiveQueryOptions';
import { trpc } from '@/web/trpc/client';

interface ComposerMediaSettingsControllerInput {
    setFeedback: (tone: 'success' | 'error' | 'info', message: string | undefined) => void;
}

export function useComposerMediaSettingsController(input: ComposerMediaSettingsControllerInput) {
    const utils = trpc.useUtils();
    const composerMediaSettingsQuery = trpc.composer.getSettings.useQuery(undefined, PROGRESSIVE_QUERY_OPTIONS);
    const composerMediaDraft = resolveComposerMediaSettingsDraft({
        settings: composerMediaSettingsQuery.data?.settings,
        draft: undefined,
    });

    const setComposerMediaSettingsMutation = trpc.composer.setSettings.useMutation({
        onSuccess: ({ settings }) => {
            input.setFeedback('success', 'Saved composer media defaults.');
            utils.composer.getSettings.setData(undefined, { settings });
        },
        onError: (error) => {
            input.setFeedback('error', error.message);
        },
    });

    return {
        draft: composerMediaDraft,
        draftKey: `${composerMediaDraft.maxImageAttachmentsPerMessage}:${composerMediaDraft.imageCompressionConcurrency}`,
        isSaving: setComposerMediaSettingsMutation.isPending,
        save: createFailClosedAsyncAction(async (draft: ComposerMediaSettingsDraft) => {
            const maxImageAttachmentsPerMessage = Number(draft.maxImageAttachmentsPerMessage);
            if (!Number.isInteger(maxImageAttachmentsPerMessage)) {
                return;
            }

            const imageCompressionConcurrency = Number(draft.imageCompressionConcurrency);
            if (!Number.isInteger(imageCompressionConcurrency)) {
                return;
            }

            await setComposerMediaSettingsMutation.mutateAsync({
                maxImageAttachmentsPerMessage,
                imageCompressionConcurrency,
            });
        }),
    };
}
