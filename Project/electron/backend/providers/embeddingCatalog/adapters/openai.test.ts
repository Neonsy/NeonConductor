import { describe, expect, it, vi } from 'vitest';

const { resolveProviderRuntimePathContextMock, resolveSecretMock } = vi.hoisted(() => ({
    resolveProviderRuntimePathContextMock: vi.fn(),
    resolveSecretMock: vi.fn(),
}));

vi.mock('@/app/backend/providers/runtimePathContext', () => ({
    resolveProviderRuntimePathContext: resolveProviderRuntimePathContextMock,
}));

vi.mock('@/app/backend/providers/service/helpers', () => ({
    resolveSecret: resolveSecretMock,
}));

import { syncOpenAIEmbeddingCatalog } from '@/app/backend/providers/embeddingCatalog/adapters/openai';

describe('syncOpenAIEmbeddingCatalog', () => {
    it('returns static OpenAI embedding models when runtime path and auth are available', async () => {
        resolveProviderRuntimePathContextMock.mockResolvedValue({
            value: {
                profileId: 'profile_local_default',
                providerId: 'openai',
                optionProfileId: 'default',
                resolvedBaseUrl: 'https://api.openai.com/v1',
            },
            isOk: () => true,
            isErr: () => false,
        });
        resolveSecretMock.mockResolvedValue('test-key');

        const result = await syncOpenAIEmbeddingCatalog({ profileId: 'profile_local_default' });
        expect(result.isOk()).toBe(true);
        if (result.isErr()) {
            throw new Error(result.error.message);
        }

        expect(result.value.providerId).toBe('openai');
        expect(result.value.models.length).toBeGreaterThan(0);
        expect(result.value.models[0]?.id).toContain('openai/');
    });

    it('fails closed when OpenAI auth is unavailable', async () => {
        resolveProviderRuntimePathContextMock.mockResolvedValue({
            value: {
                profileId: 'profile_local_default',
                providerId: 'openai',
                optionProfileId: 'default',
                resolvedBaseUrl: 'https://api.openai.com/v1',
            },
            isOk: () => true,
            isErr: () => false,
        });
        resolveSecretMock.mockResolvedValue(undefined);

        const result = await syncOpenAIEmbeddingCatalog({ profileId: 'profile_local_default' });
        expect(result.isErr()).toBe(true);
        if (result.isOk()) {
            throw new Error('Expected auth failure.');
        }
        expect(result.error.code).toBe('auth_missing');
    });
});
