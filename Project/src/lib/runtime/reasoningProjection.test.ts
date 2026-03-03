import { describe, expect, it } from 'vitest';

import { hasProviderLimitedReasoning, projectConversationParts } from '@/web/lib/runtime/reasoningProjection';

import type { MessagePartRecord } from '@/app/backend/persistence/types';

function createPart(input: {
    id: string;
    partType: MessagePartRecord['partType'];
    text?: string;
    payload?: Record<string, unknown>;
}): MessagePartRecord {
    return {
        id: input.id as MessagePartRecord['id'],
        messageId: 'msg_test' as MessagePartRecord['messageId'],
        sequence: 0,
        partType: input.partType,
        payload: input.payload ?? (input.text ? { text: input.text } : {}),
        createdAt: new Date().toISOString(),
    };
}

describe('reasoning projection', () => {
    it('keeps full reasoning text and drops encrypted payload from readable stream', () => {
        const parts = [
            createPart({ id: 'part_1', partType: 'text', text: 'Assistant answer' }),
            createPart({ id: 'part_2', partType: 'reasoning', text: 'Full chain of thought from provider' }),
            createPart({ id: 'part_3', partType: 'reasoning_encrypted', payload: { opaque: 'ciphertext' } }),
        ];

        const projected = projectConversationParts(parts);
        expect(projected).toHaveLength(2);
        expect(projected.some((part) => part.id === 'part_2')).toBe(true);
        expect(projected.some((part) => part.id === 'part_3')).toBe(false);
        expect(hasProviderLimitedReasoning(parts)).toBe(false);
    });

    it('marks summary-only reasoning as provider-limited', () => {
        const parts = [createPart({ id: 'part_4', partType: 'reasoning_summary', text: 'Reasoning summary only' })];

        const projected = projectConversationParts(parts);
        expect(projected).toHaveLength(1);
        expect(projected[0]?.providerLimitedReasoning).toBe(true);
        expect(hasProviderLimitedReasoning(parts)).toBe(true);
    });
});
