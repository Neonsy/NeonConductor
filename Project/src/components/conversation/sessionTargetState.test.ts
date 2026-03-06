import { describe, expect, it } from 'vitest';

import {
    applySessionModelOverride,
    applySessionProviderOverride,
} from '@/web/components/conversation/sessionTargetState';

describe('sessionTargetState', () => {
    it('keeps provider/model overrides isolated per session', () => {
        const firstSession = 'sess_first';
        const secondSession = 'sess_second';

        const withFirstProvider = applySessionProviderOverride({}, firstSession, 'openai', 'openai/gpt-5');
        const withSecondProvider = applySessionProviderOverride(
            withFirstProvider,
            secondSession,
            'kilo',
            'kilo/gpt-5'
        );
        const updatedFirstModel = applySessionModelOverride(
            withSecondProvider,
            firstSession,
            'openai',
            'openai/gpt-5-codex'
        );

        expect(updatedFirstModel).toEqual({
            sess_first: {
                providerId: 'openai',
                modelId: 'openai/gpt-5-codex',
            },
            sess_second: {
                providerId: 'kilo',
                modelId: 'kilo/gpt-5',
            },
        });
    });
});
