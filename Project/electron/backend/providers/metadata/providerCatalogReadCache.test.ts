import { describe, expect, it } from 'vitest';

import { ProviderCatalogReadCache } from '@/app/backend/providers/metadata/providerCatalogReadCache';
import type { ResolvedProviderCatalogContext } from '@/app/backend/providers/metadata/catalogContext';

function createContext(overrides?: Partial<ResolvedProviderCatalogContext>): ResolvedProviderCatalogContext {
    return {
        providerId: 'openai',
        profileId: 'profile_local_default',
        authMethod: 'api_key',
        credentialFingerprint: 'credential_hash',
        organizationId: null,
        optionProfileId: 'default',
        resolvedBaseUrl: 'https://api.openai.com/v1',
        cacheKey: 'cache:openai:default',
        ...overrides,
    };
}

describe('providerCatalogReadCache', () => {
    it('returns cached models while the entry is within TTL', () => {
        const cache = new ProviderCatalogReadCache(1_000);
        const context = createContext();
        const models = [
            {
                id: 'openai/gpt-5',
                profileId: 'profile_local_default',
                providerId: 'openai',
                label: 'GPT-5',
                modelId: 'openai/gpt-5',
                features: {
                    supportsTools: true,
                    supportsReasoning: true,
                    supportsVision: true,
                    supportsAudioInput: false,
                    supportsAudioOutput: false,
                    inputModalities: ['text', 'image'],
                    outputModalities: ['text'],
                },
                runtime: {
                    toolProtocol: 'openai_responses',
                    apiFamily: 'openai_compatible',
                },
                pricing: {},
                raw: {},
                source: 'provider_api',
                updatedAt: '2026-03-30T00:00:00.000Z',
                isFree: false,
            },
        ];

        cache.write(context, models as never, 100);

        expect(cache.readFresh(context, 900)).toEqual(models);
    });

    it('drops expired cache entries from reads', () => {
        const cache = new ProviderCatalogReadCache(100);
        const context = createContext();

        cache.write(context, [] as never, 100);

        expect(cache.readFresh(context, 250)).toBeNull();
    });

    it('deletes only matching cache entries', () => {
        const cache = new ProviderCatalogReadCache(1_000);
        const openAIContext = createContext();
        const kiloContext = createContext({
            providerId: 'kilo',
            resolvedBaseUrl: 'https://api.kilo.ai',
            cacheKey: 'cache:kilo:default',
        });

        cache.write(openAIContext, [] as never, 100);
        cache.write(kiloContext, [] as never, 100);
        cache.deleteMatching((entry) => entry.context.providerId === 'openai');

        expect(cache.readFresh(openAIContext, 150)).toBeNull();
        expect(cache.readFresh(kiloContext, 150)).toEqual([]);
    });
});
