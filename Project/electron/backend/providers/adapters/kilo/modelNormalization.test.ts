import { describe, expect, it } from 'vitest';

import { classifyKiloModel } from '@/app/backend/providers/adapters/kilo/modelNormalization';

const emptyClassificationInput = {
    modelsByProviderIndex: new Map<string, ReadonlySet<string>>(),
};

describe('kilo model classification', () => {
    it('maps recognized upstream providers directly when owned_by is present', () => {
        const classified = classifyKiloModel(
            {
                id: 'google/gemini-2.5-pro',
                name: 'Gemini 2.5 Pro',
                upstreamProvider: 'google',
                supportedParameters: ['tools'],
                inputModalities: ['text', 'image'],
                outputModalities: ['text'],
                pricing: {},
                raw: {},
            },
            emptyClassificationInput
        );

        expect(classified.status).toBe('accepted');
        if (classified.status !== 'accepted' || classified.model.runtime.toolProtocol !== 'kilo_gateway') {
            throw new Error('Expected kilo gateway runtime.');
        }
        expect(classified.model.runtime.routedApiFamily).toBe('google_generativeai');
    });

    it.each([
        ['moonshotai/kimi-k2.5', 'openai_compatible'],
        ['z-ai/glm-5', 'openai_compatible'],
        ['google/gemini-3.1-pro-preview', 'google_generativeai'],
        ['anthropic/claude-sonnet-4.6', 'anthropic_messages'],
    ] as const)(
        'derives routed family from provider/model namespace heuristics for %s when owned_by is missing',
        (modelId, routedApiFamily) => {
            const classified = classifyKiloModel(
                {
                    id: modelId,
                    name: modelId,
                    supportedParameters: ['tools'],
                    inputModalities: ['text'],
                    outputModalities: ['text'],
                    pricing: {},
                    raw: {},
                },
                emptyClassificationInput
            );

            expect(classified.status).toBe('accepted');
            if (classified.status !== 'accepted' || classified.model.runtime.toolProtocol !== 'kilo_gateway') {
                throw new Error('Expected kilo gateway runtime.');
            }
            expect(classified.model.runtime.routedApiFamily).toBe(routedApiFamily);
        }
    );

    it('derives frontier as anthropic via prompt-family metadata when owned_by is missing', () => {
        const classified = classifyKiloModel(
            {
                id: 'kilo-auto/frontier',
                name: 'Kilo Auto Frontier',
                promptFamily: 'anthropic',
                supportedParameters: ['tools', 'reasoning'],
                inputModalities: ['text', 'image'],
                outputModalities: ['text'],
                pricing: {},
                raw: {
                    opencode: {
                        prompt: 'anthropic',
                    },
                },
            },
            emptyClassificationInput
        );

        expect(classified.status).toBe('accepted');
        if (classified.status !== 'accepted' || classified.model.runtime.toolProtocol !== 'kilo_gateway') {
            throw new Error('Expected kilo gateway runtime.');
        }
        expect(classified.model.runtime.routedApiFamily).toBe('anthropic_messages');
    });

    it('derives small as openai-compatible via codex prompt-family metadata when owned_by is missing', () => {
        const classified = classifyKiloModel(
            {
                id: 'kilo-auto/small',
                name: 'Kilo Auto Small',
                promptFamily: 'codex',
                supportedParameters: ['tools', 'reasoning'],
                inputModalities: ['text'],
                outputModalities: ['text'],
                pricing: {},
                raw: {
                    opencode: {
                        prompt: 'codex',
                    },
                },
            },
            emptyClassificationInput
        );

        expect(classified.status).toBe('accepted');
        if (classified.status !== 'accepted' || classified.model.runtime.toolProtocol !== 'kilo_gateway') {
            throw new Error('Expected kilo gateway runtime.');
        }
        expect(classified.model.runtime.routedApiFamily).toBe('openai_compatible');
    });

    it.each([
        'kilo-auto/balanced',
        'kilo-auto/free',
        'minimax/minimax-m2.5:free',
        'x-ai/grok-4-fast',
        'mistral/medium-3.1',
        'mystery/model',
    ])('classifies %s as openai-compatible when Kilo can proxy it through the shared gateway', (modelId) => {
        const classified = classifyKiloModel(
            {
                id: modelId,
                name: modelId,
                supportedParameters: ['tools', 'reasoning'],
                inputModalities: ['text'],
                outputModalities: ['text'],
                pricing: {},
                raw: {},
            },
            emptyClassificationInput
        );

        expect(classified.status).toBe('accepted');
        if (classified.status !== 'accepted' || classified.model.runtime.toolProtocol !== 'kilo_gateway') {
            throw new Error('Expected kilo gateway runtime.');
        }
        expect(classified.model.runtime.routedApiFamily).toBe('openai_compatible');
    });

    it('rejects provider-native hints instead of guessing a gateway runtime family', () => {
        const classified = classifyKiloModel(
            {
                id: 'minimax/minimax-native',
                name: 'MiniMax Native',
                upstreamProvider: 'minimax',
                supportedParameters: ['tools'],
                inputModalities: ['text'],
                outputModalities: ['text'],
                pricing: {},
                raw: {
                    provider_native_id: 'minimax_openai_compat',
                },
            },
            emptyClassificationInput
        );

        expect(classified).toMatchObject({
            status: 'rejected',
            diagnostic: {
                reason: 'provider_native',
            },
        });
    });

    it('rejects contradictory special-family metadata instead of picking one arbitrarily', () => {
        const classified = classifyKiloModel(
            {
                id: 'google/gemini-2.5-pro',
                name: 'Gemini 2.5 Pro',
                promptFamily: 'anthropic',
                supportedParameters: ['tools'],
                inputModalities: ['text'],
                outputModalities: ['text'],
                pricing: {},
                raw: {},
            },
            emptyClassificationInput
        );

        expect(classified).toMatchObject({
            status: 'rejected',
            diagnostic: {
                reason: 'contradictory_metadata',
            },
        });
    });

    it('rejects rows with no namespace or metadata to derive a runnable family', () => {
        const classified = classifyKiloModel(
            {
                id: 'mystery',
                name: 'Mystery',
                supportedParameters: ['tools'],
                inputModalities: ['text'],
                outputModalities: ['text'],
                pricing: {},
                raw: {},
            },
            emptyClassificationInput
        );

        expect(classified).toMatchObject({
            status: 'rejected',
            diagnostic: {
                reason: 'missing_runtime_family',
            },
        });
    });
});
