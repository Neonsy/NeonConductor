import { beforeEach, describe, expect, it, vi } from 'vitest';

import { kiloFrontierModelId } from '@/shared/kiloModels';

const providerStoreMock = vi.hoisted(() => ({
    getDefaults: vi.fn(),
    getSpecialistDefaults: vi.fn(),
    modelExists: vi.fn(),
}));

vi.mock('@/app/backend/persistence/stores', () => ({
    providerStore: providerStoreMock,
}));

import {
    resolveRequestedOrDefaultRunTarget,
    verifyResolvedRunTargetAvailability,
} from '@/app/backend/runtime/services/runExecution/resolveRunTarget';

describe('resolveRunTarget boundaries', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        providerStoreMock.getDefaults.mockResolvedValue({
            providerId: 'openai',
            modelId: 'openai/gpt-5',
        });
        providerStoreMock.getSpecialistDefaults.mockResolvedValue([]);
    });

    it('fails closed when a verified explicit model is unavailable for the provider', async () => {
        providerStoreMock.modelExists.mockResolvedValue(false);

        const resolvedTarget = await resolveRequestedOrDefaultRunTarget({
            profileId: 'profile_default',
            providerId: 'openai',
            modelId: 'openai/gpt-missing',
        });
        expect(resolvedTarget.isOk()).toBe(true);
        if (resolvedTarget.isErr()) {
            throw new Error(resolvedTarget.error.message);
        }

        const result = await verifyResolvedRunTargetAvailability({
            profileId: 'profile_default',
            target: resolvedTarget.value,
        });

        expect(result.isErr()).toBe(true);
        if (result.isOk()) {
            throw new Error('Expected explicit unavailable model to be rejected.');
        }
        expect(result.error.code).toBe('provider_model_not_available');
        expect(result.error.message).toContain('openai/gpt-missing');
    });

    it('uses the saved default only when the caller omitted both provider and model', async () => {
        const result = await resolveRequestedOrDefaultRunTarget({
            profileId: 'profile_default',
        });

        expect(result.isOk()).toBe(true);
        if (result.isErr()) {
            throw new Error(result.error.message);
        }
        expect(result.value).toEqual({
            providerId: 'openai',
            modelId: 'openai/gpt-5',
        });
    });

    it('prefers the matching specialist default over the shared fallback for runnable presets', async () => {
        providerStoreMock.getSpecialistDefaults.mockResolvedValue([
            {
                topLevelTab: 'agent',
                modeKey: 'code',
                providerId: 'kilo',
                modelId: kiloFrontierModelId,
            },
        ]);
        const result = await resolveRequestedOrDefaultRunTarget({
            profileId: 'profile_default',
            topLevelTab: 'agent',
            modeKey: 'code',
        });

        expect(result.isOk()).toBe(true);
        if (result.isErr()) {
            throw new Error(result.error.message);
        }
        expect(result.value).toEqual({
            providerId: 'kilo',
            modelId: kiloFrontierModelId,
        });
    });

    it('does not depend on shared-default lookup when the caller provides an explicit target', async () => {
        const result = await resolveRequestedOrDefaultRunTarget({
            profileId: 'profile_default',
            providerId: 'openai',
            modelId: 'openai/gpt-5',
        });

        expect(result.isOk()).toBe(true);
        if (result.isErr()) {
            throw new Error(result.error.message);
        }
        expect(providerStoreMock.getDefaults).not.toHaveBeenCalled();
        expect(providerStoreMock.getSpecialistDefaults).not.toHaveBeenCalled();
        expect(result.value).toEqual({
            providerId: 'openai',
            modelId: 'openai/gpt-5',
        });
    });
});
