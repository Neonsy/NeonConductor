import { describe, expect, it } from 'vitest';

import type { MessageTimelineEntry } from '@/web/components/conversation/messageTimelineModel';
import { createPendingMessageEdit } from '@/web/components/conversation/pendingMessageEdit';

describe('createPendingMessageEdit', () => {
    it('creates pending edit state for editable messages and supports forced branch mode', () => {
        const entry: MessageTimelineEntry = {
            id: 'msg_123',
            runId: 'run_123',
            role: 'user',
            createdAt: new Date().toISOString(),
            body: [],
            editableText: '  Original text  ',
        };

        expect(createPendingMessageEdit(entry)).toEqual({
            messageId: 'msg_123',
            initialText: 'Original text',
        });
        expect(createPendingMessageEdit(entry, 'branch')).toEqual({
            messageId: 'msg_123',
            initialText: 'Original text',
            forcedMode: 'branch',
        });
    });

    it('rejects non-editable or invalid message entries', () => {
        expect(
            createPendingMessageEdit({
                id: 'run_123',
                runId: 'run_123',
                role: 'user',
                createdAt: new Date().toISOString(),
                body: [],
                editableText: 'x',
            })
        ).toBeUndefined();

        expect(
            createPendingMessageEdit({
                id: 'msg_123',
                runId: 'run_123',
                role: 'assistant',
                createdAt: new Date().toISOString(),
                body: [],
                editableText: '   ',
            })
        ).toBeUndefined();
    });
});
