import { useState } from 'react';

import { useComposerMediaSettingsController } from '@/web/components/settings/contextSettings/useComposerMediaSettingsController';
import { useContextDefaultsController } from '@/web/components/settings/contextSettings/useContextDefaultsController';
import { useContextPreviewReadModel } from '@/web/components/settings/contextSettings/useContextPreviewReadModel';
import { useContextSelectionState } from '@/web/components/settings/contextSettings/useContextSelectionState';
import { useProfileContextOverrideController } from '@/web/components/settings/contextSettings/useProfileContextOverrideController';

interface UseContextSettingsControllerInput {
    activeProfileId: string;
}

export function useContextSettingsController({ activeProfileId }: UseContextSettingsControllerInput) {
    const [feedbackMessage, setFeedbackMessage] = useState<string | undefined>(undefined);
    const [feedbackTone, setFeedbackTone] = useState<'success' | 'error' | 'info'>('info');

    const clearFeedback = (): void => {
        setFeedbackMessage(undefined);
    };
    const setFeedback = (tone: 'success' | 'error' | 'info', message: string | undefined): void => {
        setFeedbackTone(tone);
        setFeedbackMessage(message);
    };

    const selection = useContextSelectionState({
        activeProfileId,
        onSelectionChanged: clearFeedback,
    });
    const resolvedPreview = useContextPreviewReadModel({
        profileId: selection.selectedProfileId,
    });
    const composerMedia = useComposerMediaSettingsController({
        setFeedback,
    });
    const globalDefaults = useContextDefaultsController({
        previewQueryInput: resolvedPreview.resolvedContextStateQueryInput,
        setFeedback,
    });
    const profileOverride = useProfileContextOverrideController({
        profileId: selection.selectedProfileId,
        previewQueryInput: resolvedPreview.resolvedContextStateQueryInput,
        resolvedContextState: resolvedPreview.resolvedContextStateQuery,
        setFeedback,
    });

    return {
        selection,
        feedback: {
            message: feedbackMessage,
            tone: feedbackTone,
            clear: clearFeedback,
        },
        composerMedia,
        globalDefaults,
        profileOverride,
        resolvedPreview: {
            defaultModel: resolvedPreview.resolvedPreviewTarget?.defaultModel,
            defaultProvider: resolvedPreview.resolvedPreviewTarget?.defaultProvider,
            state: resolvedPreview.resolvedContextStateQuery.data,
        },
    };
}
