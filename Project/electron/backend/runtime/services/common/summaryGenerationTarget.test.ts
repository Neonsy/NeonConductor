import { beforeEach, describe, expect, it, vi } from 'vitest';

const { resolveUtilityModelTargetMock, resolvePolicyMock, estimatePreparedContextMessagesMock } = vi.hoisted(() => ({
    resolveUtilityModelTargetMock: vi.fn(),
    resolvePolicyMock: vi.fn(),
    estimatePreparedContextMessagesMock: vi.fn(),
}));

vi.mock('@/app/backend/runtime/services/profile/utilityModel', () => ({
    utilityModelService: {
        resolveUtilityModelTarget: resolveUtilityModelTargetMock,
    },
}));

vi.mock('@/app/backend/runtime/services/context/policyService', () => ({
    contextPolicyService: {
        resolvePolicy: resolvePolicyMock,
    },
}));

vi.mock('@/app/backend/runtime/services/context/sessionContextBudgetEvaluator', () => ({
    estimatePreparedContextMessages: estimatePreparedContextMessagesMock,
}));

import { resolveSummaryGenerationTarget } from '@/app/backend/runtime/services/common/summaryGenerationTarget';
import { createTextMessage } from '@/app/backend/runtime/services/runExecution/contextParts';

describe('resolveSummaryGenerationTarget', () => {
    beforeEach(() => {
        resolveUtilityModelTargetMock.mockReset();
        resolvePolicyMock.mockReset();
        estimatePreparedContextMessagesMock.mockReset();
    });

    it('returns the utility target when it fits the summary request', async () => {
        resolveUtilityModelTargetMock.mockResolvedValue({
            providerId: 'zai',
            modelId: 'zai/glm-4.5-air',
            source: 'utility',
        });
        resolvePolicyMock.mockResolvedValue({
            limits: { modelLimitsKnown: true },
            usableInputBudgetTokens: 200,
            disabledReason: null,
        });
        estimatePreparedContextMessagesMock.mockResolvedValue({
            estimate: {
                totalTokens: 100,
            },
        });

        const result = await resolveSummaryGenerationTarget({
            profileId: 'profile_test',
            fallbackProviderId: 'openai',
            fallbackModelId: 'openai/gpt-5',
            summaryMessages: [createTextMessage('user', 'hello')],
            requireFallbackFit: true,
        });

        expect(result).toEqual({
            providerId: 'zai',
            modelId: 'zai/glm-4.5-air',
            source: 'utility',
        });
    });

    it('falls back to the active model when utility does not fit and fallback does', async () => {
        resolveUtilityModelTargetMock.mockResolvedValue({
            providerId: 'zai',
            modelId: 'zai/glm-4.5-air',
            source: 'utility',
        });
        resolvePolicyMock
            .mockResolvedValueOnce({
                limits: { modelLimitsKnown: true },
                usableInputBudgetTokens: 50,
                disabledReason: null,
            })
            .mockResolvedValueOnce({
                limits: { modelLimitsKnown: true },
                usableInputBudgetTokens: 200,
                disabledReason: null,
            });
        estimatePreparedContextMessagesMock
            .mockResolvedValueOnce({
                estimate: {
                    totalTokens: 100,
                },
            })
            .mockResolvedValueOnce({
                estimate: {
                    totalTokens: 100,
                },
            });

        const result = await resolveSummaryGenerationTarget({
            profileId: 'profile_test',
            fallbackProviderId: 'openai',
            fallbackModelId: 'openai/gpt-5',
            summaryMessages: [createTextMessage('user', 'hello')],
            requireFallbackFit: true,
        });

        expect(result).toEqual({
            providerId: 'openai',
            modelId: 'openai/gpt-5',
            source: 'fallback',
        });
    });

    it('returns null when both utility and fallback cannot fit the summary request', async () => {
        resolveUtilityModelTargetMock.mockResolvedValue({
            providerId: 'zai',
            modelId: 'zai/glm-4.5-air',
            source: 'utility',
        });
        resolvePolicyMock.mockResolvedValue({
            limits: { modelLimitsKnown: true },
            usableInputBudgetTokens: 50,
            disabledReason: null,
        });
        estimatePreparedContextMessagesMock.mockResolvedValue({
            estimate: {
                totalTokens: 100,
            },
        });

        const result = await resolveSummaryGenerationTarget({
            profileId: 'profile_test',
            fallbackProviderId: 'openai',
            fallbackModelId: 'openai/gpt-5',
            summaryMessages: [createTextMessage('user', 'hello')],
            requireFallbackFit: true,
        });

        expect(result).toBeNull();
    });
});
