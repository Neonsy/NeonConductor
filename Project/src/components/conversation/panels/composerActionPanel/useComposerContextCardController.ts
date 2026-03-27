import { useEffect, useState } from 'react';

import type { ComposerActionFeedback } from '@/web/components/conversation/panels/composerActionPanel/types';

export interface ComposerContextCardControllerInput {
    selectedProviderId: string | undefined;
    selectedModelId: string | undefined;
    topLevelTab: string;
    activeModeKey: string;
    onCompactContext: (() => Promise<ComposerActionFeedback | undefined>) | undefined;
}

export function useComposerContextCardController(input: ComposerContextCardControllerInput) {
    const [contextFeedback, setContextFeedback] = useState<ComposerActionFeedback | undefined>(undefined);

    useEffect(() => {
        setContextFeedback(undefined);
    }, [input.activeModeKey, input.selectedModelId, input.selectedProviderId, input.topLevelTab]);

    return {
        contextFeedback,
        async handleCompactContext() {
            if (!input.onCompactContext) {
                return;
            }

            setContextFeedback(undefined);
            try {
                const result = await input.onCompactContext();
                if (result) {
                    setContextFeedback(result);
                }
            } catch (error) {
                setContextFeedback({
                    tone: 'error',
                    message: error instanceof Error ? error.message : 'Context compaction failed.',
                });
            }
        },
    };
}
