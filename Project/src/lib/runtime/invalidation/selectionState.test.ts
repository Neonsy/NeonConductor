import { afterEach, describe, expect, it, vi } from 'vitest';

import { readConversationSelectionState } from '@/web/lib/runtime/invalidation/selectionState';

function stubStorage(value: string | null) {
    vi.stubGlobal('window', {
        localStorage: {
            getItem: () => value,
            setItem: () => undefined,
            removeItem: () => undefined,
        },
    });
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('readConversationSelectionState', () => {
    it('reads persisted selection ids when they are valid', () => {
        stubStorage(JSON.stringify({ selectedSessionId: 'sess_1', selectedRunId: 'run_1' }));

        expect(readConversationSelectionState('profile_default')).toEqual({
            selectedSessionId: 'sess_1',
            selectedRunId: 'run_1',
        });
    });

    it('fails closed on malformed persisted state', () => {
        stubStorage('{"selectedSessionId":"bad"}');

        expect(readConversationSelectionState('profile_default')).toEqual({
            selectedSessionId: undefined,
            selectedRunId: undefined,
        });
    });
});
