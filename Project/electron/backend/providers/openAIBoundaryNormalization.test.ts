import { describe, expect, it } from 'vitest';

import { normalizeSpecialistDefaults } from '@/app/backend/providers/openAIBoundaryNormalization';

describe('normalizeSpecialistDefaults', () => {
    it('remaps OpenAI Codex specialist defaults onto the dedicated provider boundary', () => {
        expect(
            normalizeSpecialistDefaults([
                {
                    topLevelTab: 'agent',
                    modeKey: 'code',
                    providerId: 'openai',
                    modelId: 'openai/codex-mini-latest',
                },
            ])
        ).toEqual([
            {
                topLevelTab: 'agent',
                modeKey: 'code',
                providerId: 'openai_codex',
                modelId: 'openai_codex/codex-mini-latest',
            },
        ]);
    });

    it('rejects invalid specialist default targets instead of casting them through', () => {
        expect(
            normalizeSpecialistDefaults([
                {
                    topLevelTab: 'chat',
                    modeKey: 'ask',
                    providerId: 'openai',
                    modelId: 'openai/gpt-5',
                },
            ])
        ).toBeUndefined();
    });

    it('rejects invalid specialist default provider ids instead of casting them through', () => {
        expect(
            normalizeSpecialistDefaults([
                {
                    topLevelTab: 'agent',
                    modeKey: 'ask',
                    providerId: 'not-a-provider',
                    modelId: 'openai/gpt-5',
                },
            ])
        ).toBeUndefined();
    });
});
