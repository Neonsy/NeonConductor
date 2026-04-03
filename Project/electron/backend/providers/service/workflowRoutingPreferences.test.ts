import { beforeEach, describe, expect, it, vi } from 'vitest';

const providerStoreMocks = vi.hoisted(() => ({
    getWorkflowRoutingPreferences: vi.fn(),
    setWorkflowRoutingPreference: vi.fn(),
    clearWorkflowRoutingPreference: vi.fn(),
    getModelCapabilities: vi.fn(),
    providerExists: vi.fn(),
}));

const helperMocks = vi.hoisted(() => ({
    ensureSupportedProvider: vi.fn(),
}));

vi.mock('@/app/backend/persistence/stores', () => ({
    providerStore: providerStoreMocks,
}));

vi.mock('@/app/backend/providers/service/helpers', () => ({
    ensureSupportedProvider: helperMocks.ensureSupportedProvider,
}));

import {
    clearWorkflowRoutingPreference,
    getWorkflowRoutingPreferences,
    setWorkflowRoutingPreference,
} from '@/app/backend/providers/service/preferenceService';

describe('workflow routing preferences', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        helperMocks.ensureSupportedProvider.mockResolvedValue({
            isErr: () => false,
            isOk: () => true,
            value: 'openai',
            map: (mapper: (value: 'openai') => unknown) => ({
                isErr: () => false,
                isOk: () => true,
                value: mapper('openai'),
            }),
        });
        providerStoreMocks.getWorkflowRoutingPreferences.mockResolvedValue([]);
        providerStoreMocks.setWorkflowRoutingPreference.mockResolvedValue([]);
        providerStoreMocks.clearWorkflowRoutingPreference.mockResolvedValue([]);
        providerStoreMocks.getModelCapabilities.mockResolvedValue({
            features: {
                supportsTools: true,
                supportsReasoning: true,
            },
        });
    });

    it('returns persisted workflow routing preferences', async () => {
        providerStoreMocks.getWorkflowRoutingPreferences.mockResolvedValueOnce([
            {
                targetKey: 'planning',
                providerId: 'openai',
                modelId: 'openai/gpt-5',
            },
        ]);

        await expect(getWorkflowRoutingPreferences('profile_default')).resolves.toEqual([
            {
                targetKey: 'planning',
                providerId: 'openai',
                modelId: 'openai/gpt-5',
            },
        ]);
    });

    it('rejects workflow routing preference updates for unsupported providers', async () => {
        helperMocks.ensureSupportedProvider.mockResolvedValueOnce({
            isErr: () => true,
            isOk: () => false,
            error: { message: 'provider missing' },
        });

        const result = await setWorkflowRoutingPreference({
            profileId: 'profile_default',
            targetKey: 'planning',
            providerId: 'openai',
            modelId: 'openai/gpt-5',
        });

        expect(result.success).toBe(false);
        expect(result.reason).toBe('provider_not_found');
        expect(providerStoreMocks.setWorkflowRoutingPreference).not.toHaveBeenCalled();
    });

    it('rejects workflow routing preference updates when the model is missing', async () => {
        providerStoreMocks.getModelCapabilities.mockResolvedValueOnce(null);

        const result = await setWorkflowRoutingPreference({
            profileId: 'profile_default',
            targetKey: 'planning',
            providerId: 'openai',
            modelId: 'openai/missing',
        });

        expect(result.success).toBe(false);
        expect(result.reason).toBe('model_not_found');
        expect(providerStoreMocks.setWorkflowRoutingPreference).not.toHaveBeenCalled();
    });

    it('rejects advanced planning workflow routing preferences that are not reasoning-capable', async () => {
        providerStoreMocks.getModelCapabilities.mockResolvedValueOnce({
            features: {
                supportsTools: true,
                supportsReasoning: false,
            },
        });

        const result = await setWorkflowRoutingPreference({
            profileId: 'profile_default',
            targetKey: 'planning_advanced',
            providerId: 'openai',
            modelId: 'openai/gpt-5-mini',
        });

        expect(result.success).toBe(false);
        expect(result.reason).toBe('model_not_compatible');
        expect(providerStoreMocks.setWorkflowRoutingPreference).not.toHaveBeenCalled();
    });

    it('allows simple planning workflow routing preferences for lesser models', async () => {
        providerStoreMocks.getModelCapabilities.mockResolvedValueOnce({
            features: {
                supportsTools: true,
                supportsReasoning: false,
            },
        });
        providerStoreMocks.setWorkflowRoutingPreference.mockResolvedValueOnce([
            {
                targetKey: 'planning',
                providerId: 'openai',
                modelId: 'openai/gpt-5-mini',
            },
        ]);

        const result = await setWorkflowRoutingPreference({
            profileId: 'profile_default',
            targetKey: 'planning',
            providerId: 'openai',
            modelId: 'openai/gpt-5-mini',
        });

        expect(result.success).toBe(true);
        expect(result.workflowRoutingPreference).toEqual({
            targetKey: 'planning',
            providerId: 'openai',
            modelId: 'openai/gpt-5-mini',
        });
        expect(providerStoreMocks.setWorkflowRoutingPreference).toHaveBeenCalledTimes(1);
    });

    it('rejects planning workflow routing preferences for models without native tools', async () => {
        providerStoreMocks.getModelCapabilities.mockResolvedValueOnce({
            features: {
                supportsTools: false,
                supportsReasoning: true,
            },
        });

        const result = await setWorkflowRoutingPreference({
            profileId: 'profile_default',
            targetKey: 'planning',
            providerId: 'openai',
            modelId: 'openai/gpt-5-text',
        });

        expect(result.success).toBe(false);
        expect(result.reason).toBe('model_not_compatible');
        expect(providerStoreMocks.setWorkflowRoutingPreference).not.toHaveBeenCalled();
    });

    it('persists workflow routing preferences and clears individual targets', async () => {
        providerStoreMocks.setWorkflowRoutingPreference.mockResolvedValueOnce([
            {
                targetKey: 'planning',
                providerId: 'openai',
                modelId: 'openai/gpt-5',
            },
            {
                targetKey: 'planning_advanced',
                providerId: 'openai',
                modelId: 'openai/gpt-5.1',
            },
        ]);
        providerStoreMocks.clearWorkflowRoutingPreference.mockResolvedValueOnce([
            {
                targetKey: 'planning_advanced',
                providerId: 'openai',
                modelId: 'openai/gpt-5.1',
            },
        ]);

        const setResult = await setWorkflowRoutingPreference({
            profileId: 'profile_default',
            targetKey: 'planning',
            providerId: 'openai',
            modelId: 'openai/gpt-5',
        });
        expect(setResult.success).toBe(true);
        expect(setResult.workflowRoutingPreference).toEqual({
            targetKey: 'planning',
            providerId: 'openai',
            modelId: 'openai/gpt-5',
        });
        expect(setResult.workflowRoutingPreferences).toEqual([
            {
                targetKey: 'planning',
                providerId: 'openai',
                modelId: 'openai/gpt-5',
            },
            {
                targetKey: 'planning_advanced',
                providerId: 'openai',
                modelId: 'openai/gpt-5.1',
            },
        ]);

        const clearResult = await clearWorkflowRoutingPreference({
            profileId: 'profile_default',
            targetKey: 'planning',
        });

        expect(clearResult.success).toBe(true);
        expect(clearResult.workflowRoutingPreferences).toEqual([
            {
                targetKey: 'planning_advanced',
                providerId: 'openai',
                modelId: 'openai/gpt-5.1',
            },
        ]);
    });
});
