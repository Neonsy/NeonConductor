import { useEffect, useRef, useState } from 'react';

export function useComposerDraftController(input: {
    promptResetKey?: number;
    focusComposerRequestKey?: number;
}) {
    const [draftPrompt, setDraftPrompt] = useState('');
    const promptTextareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        setDraftPrompt('');
    }, [input.promptResetKey]);

    useEffect(() => {
        if (input.focusComposerRequestKey === undefined) {
            return;
        }

        promptTextareaRef.current?.focus();
    }, [input.focusComposerRequestKey]);

    return {
        draftPrompt,
        setDraftPrompt,
        promptTextareaRef,
        focusPrompt() {
            promptTextareaRef.current?.focus();
        },
    };
}
