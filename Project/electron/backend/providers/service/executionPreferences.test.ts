import { describe, expect, it } from 'vitest';

import { isOpenAIExecutionMode, normalizeStoredMode } from '@/app/backend/providers/service/executionPreferences';

describe('normalizeStoredMode', () => {
    it('preserves valid stored execution modes', () => {
        expect(normalizeStoredMode('realtime_websocket')).toBe('realtime_websocket');
        expect(isOpenAIExecutionMode('standard_http')).toBe(true);
    });

    it('falls back for invalid stored execution modes', () => {
        expect(normalizeStoredMode('not-real')).toBe('standard_http');
        expect(isOpenAIExecutionMode('not-real')).toBe(false);
    });
});
