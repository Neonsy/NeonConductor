import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { MessageEditDialog, createMessageEditDraftState } from '@/web/components/conversation/panels/messageEditDialog';

describe('MessageEditDialog', () => {
    it('creates the expected initial draft state', () => {
        expect(
            createMessageEditDraftState({
                initialText: 'Replace me',
                preferredResolution: 'ask',
            })
        ).toEqual({
            replacementText: 'Replace me',
            editMode: 'truncate',
            rememberChoice: false,
        });

        expect(
            createMessageEditDraftState({
                initialText: 'Replace me',
                preferredResolution: 'branch',
            })
        ).toEqual({
            replacementText: 'Replace me',
            editMode: 'branch',
            rememberChoice: false,
        });
    });

    it('renders the current open snapshot and hides when closed', () => {
        const openHtml = renderToStaticMarkup(
            <MessageEditDialog
                open
                initialText='Different upstream text'
                preferredResolution='branch'
                busy={false}
                onCancel={vi.fn()}
                onSave={vi.fn()}
            />
        );

        const closedHtml = renderToStaticMarkup(
            <MessageEditDialog
                open={false}
                initialText='Different upstream text'
                preferredResolution='branch'
                busy={false}
                onCancel={vi.fn()}
                onSave={vi.fn()}
            />
        );

        expect(openHtml).toContain('Different upstream text');
        expect(openHtml).toContain('Branch mode creates a new session');
        expect(closedHtml).toBe('');
    });

    it('respects forced branch mode in the initial draft state', () => {
        expect(
            createMessageEditDraftState({
                initialText: 'Replace me',
                preferredResolution: 'truncate',
                forcedMode: 'branch',
            })
        ).toEqual({
            replacementText: 'Replace me',
            editMode: 'branch',
            rememberChoice: false,
        });
    });
});
