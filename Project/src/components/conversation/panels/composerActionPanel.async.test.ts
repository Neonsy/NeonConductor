import { describe, expect, it, vi } from 'vitest';

import { handleComposerSlashAcceptance } from '@/web/components/conversation/panels/composerActionPanel';

describe('handleComposerSlashAcceptance', () => {
    it('submits the prompt when slash acceptance is not handled from form submit', async () => {
        const onSubmitPrompt = vi.fn();
        const onSetDraftPrompt = vi.fn();
        const onFocusPrompt = vi.fn();
        const onError = vi.fn();

        await handleComposerSlashAcceptance({
            acceptHighlighted: () => Promise.resolve({ handled: false }),
            draftPrompt: 'run this',
            submitWhenUnhandled: true,
            onSubmitPrompt,
            onSetDraftPrompt,
            onFocusPrompt,
            onError,
        });

        expect(onSubmitPrompt).toHaveBeenCalledWith('run this');
        expect(onSetDraftPrompt).not.toHaveBeenCalled();
        expect(onFocusPrompt).not.toHaveBeenCalled();
        expect(onError).toHaveBeenNthCalledWith(1, undefined);
    });

    it('reports slash-command failures through controlled local error handling', async () => {
        const onSubmitPrompt = vi.fn();
        const onSetDraftPrompt = vi.fn();
        const onFocusPrompt = vi.fn();
        const onError = vi.fn();

        await handleComposerSlashAcceptance({
            acceptHighlighted: () => Promise.reject(new Error('Attach failed.')),
            draftPrompt: 'run this',
            submitWhenUnhandled: false,
            onSubmitPrompt,
            onSetDraftPrompt,
            onFocusPrompt,
            onError,
        });

        expect(onSubmitPrompt).not.toHaveBeenCalled();
        expect(onSetDraftPrompt).not.toHaveBeenCalled();
        expect(onFocusPrompt).not.toHaveBeenCalled();
        expect(onError).toHaveBeenNthCalledWith(1, undefined);
        expect(onError).toHaveBeenNthCalledWith(2, 'Attach failed.');
    });
});
