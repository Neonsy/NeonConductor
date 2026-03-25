import { describe, expect, it } from 'vitest';

import { readParsedState } from '@/app/backend/runtime/services/memory/projection';

describe('readParsedState', () => {
    it('parses valid memory states', () => {
        expect(readParsedState({ state: 'active' })).toBe('active');
        expect(readParsedState({ state: 'disabled' })).toBe('disabled');
    });

    it('throws for invalid memory states', () => {
        expect(() => readParsedState({ state: 'unknown' })).toThrow('Invalid "state"');
    });
});
