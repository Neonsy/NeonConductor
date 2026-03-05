import { describe, expect, it } from 'vitest';

import { buildTimelineEntries, isWithinBottomThreshold } from '@/web/components/conversation/messageTimelineModel';

import type { MessagePartRecord, MessageRecord } from '@/app/backend/persistence/types';

function createMessage(input: { id: string; role: MessageRecord['role']; createdAt?: string }): MessageRecord {
    const createdAt = input.createdAt ?? '2026-01-01T00:00:00.000Z';
    return {
        id: input.id as MessageRecord['id'],
        profileId: 'profile_test',
        sessionId: 'sess_test' as MessageRecord['sessionId'],
        runId: 'run_test' as MessageRecord['runId'],
        role: input.role,
        createdAt,
        updatedAt: createdAt,
    };
}

function createPart(input: {
    id: string;
    messageId: string;
    partType: MessagePartRecord['partType'];
    text?: string;
    payload?: Record<string, unknown>;
}): MessagePartRecord {
    return {
        id: input.id as MessagePartRecord['id'],
        messageId: input.messageId as MessagePartRecord['messageId'],
        sequence: 0,
        partType: input.partType,
        payload: input.payload ?? (input.text ? { text: input.text } : {}),
        createdAt: '2026-01-01T00:00:00.000Z',
    };
}

describe('message timeline model', () => {
    it('projects assistant text and reasoning parts while omitting encrypted reasoning', () => {
        const message = createMessage({ id: 'msg_assistant', role: 'assistant' });
        const parts = [
            createPart({ id: 'part_text', messageId: message.id, partType: 'text', text: 'Answer body' }),
            createPart({ id: 'part_reasoning', messageId: message.id, partType: 'reasoning', text: 'Thinking steps' }),
            createPart({
                id: 'part_summary',
                messageId: message.id,
                partType: 'reasoning_summary',
                text: 'Reasoning summary',
            }),
            createPart({
                id: 'part_encrypted',
                messageId: message.id,
                partType: 'reasoning_encrypted',
                payload: { opaque: 'cipher' },
            }),
        ];

        const entries = buildTimelineEntries([message], new Map([[message.id, parts]]));
        expect(entries).toHaveLength(1);
        expect(entries[0]?.body.map((item) => item.id)).toEqual(['part_text', 'part_reasoning', 'part_summary']);
        expect(entries[0]?.body[2]?.providerLimitedReasoning).toBe(true);
    });

    it('projects user message text parts only', () => {
        const message = createMessage({ id: 'msg_user', role: 'user' });
        const parts = [
            createPart({ id: 'part_user_text', messageId: message.id, partType: 'text', text: 'User prompt' }),
            createPart({ id: 'part_empty', messageId: message.id, partType: 'text', text: '    ' }),
            createPart({ id: 'part_no_text', messageId: message.id, partType: 'text', payload: { notText: true } }),
        ];

        const entries = buildTimelineEntries([message], new Map([[message.id, parts]]));
        expect(entries).toHaveLength(1);
        expect(entries[0]?.body).toHaveLength(1);
        expect(entries[0]?.body[0]?.type).toBe('user_text');
        expect(entries[0]?.body[0]?.text).toBe('User prompt');
    });

    it('returns true when within the default bottom threshold and false when far away', () => {
        const nearBottom = isWithinBottomThreshold({
            scrollHeight: 3000,
            scrollTop: 2050,
            clientHeight: 900,
        });
        expect(nearBottom).toBe(true);

        const farFromBottom = isWithinBottomThreshold({
            scrollHeight: 3000,
            scrollTop: 1500,
            clientHeight: 900,
        });
        expect(farFromBottom).toBe(false);
    });
});
