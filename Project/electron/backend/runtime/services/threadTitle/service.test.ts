import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ok } from 'neverthrow';

const {
    listModelsMock,
    modelExistsMock,
    getThreadBySessionIdMock,
    renameThreadMock,
    listRunsBySessionMock,
    getStringOptionalMock,
    shouldUseUtilityModelMock,
    resolveUtilityModelTargetMock,
    generatePlainTextFromMessagesMock,
    warnMock,
} = vi.hoisted(() => ({
    listModelsMock: vi.fn(),
    modelExistsMock: vi.fn(),
    getThreadBySessionIdMock: vi.fn(),
    renameThreadMock: vi.fn(),
    listRunsBySessionMock: vi.fn(),
    getStringOptionalMock: vi.fn(),
    shouldUseUtilityModelMock: vi.fn(),
    resolveUtilityModelTargetMock: vi.fn(),
    generatePlainTextFromMessagesMock: vi.fn(),
    warnMock: vi.fn(),
}));

vi.mock('@/app/backend/persistence/stores', () => ({
    providerStore: {
        listModels: listModelsMock,
        modelExists: modelExistsMock,
    },
    runStore: {
        listBySession: listRunsBySessionMock,
    },
    settingsStore: {
        getStringOptional: getStringOptionalMock,
    },
    threadStore: {
        getBySessionId: getThreadBySessionIdMock,
        rename: renameThreadMock,
    },
}));

vi.mock('@/app/backend/runtime/services/profile/utilityModel', () => ({
    utilityModelService: {
        resolveUtilityModelTarget: resolveUtilityModelTargetMock,
    },
}));

vi.mock('@/app/backend/runtime/services/profile/utilityModelConsumerPreferences', () => ({
    utilityModelConsumerPreferencesService: {
        shouldUseUtilityModel: shouldUseUtilityModelMock,
    },
}));

vi.mock('@/app/backend/runtime/services/common/plainTextGeneration', () => ({
    generatePlainTextFromMessages: generatePlainTextFromMessagesMock,
}));

vi.mock('@/app/main/logging', () => ({
    appLog: {
        warn: warnMock,
    },
}));

import { threadTitleService } from '@/app/backend/runtime/services/threadTitle/service';

describe('threadTitleService', () => {
    beforeEach(() => {
        listModelsMock.mockReset();
        modelExistsMock.mockReset();
        getThreadBySessionIdMock.mockReset();
        renameThreadMock.mockReset();
        listRunsBySessionMock.mockReset();
        getStringOptionalMock.mockReset();
        shouldUseUtilityModelMock.mockReset();
        resolveUtilityModelTargetMock.mockReset();
        generatePlainTextFromMessagesMock.mockReset();
        warnMock.mockReset();
    });

    function arrangeCommonTitleMocks() {
        getThreadBySessionIdMock.mockResolvedValue({
            thread: {
                id: 'thr_test',
                title: 'New Chat',
            },
        });
        modelExistsMock.mockResolvedValue(true);
        listRunsBySessionMock.mockResolvedValue([{ id: 'run_1' }]);
        getStringOptionalMock.mockResolvedValue('utility_refine');
        shouldUseUtilityModelMock.mockResolvedValue(true);
        listModelsMock.mockResolvedValue([{ id: 'openai/gpt-5', label: 'GPT-5' }]);
        renameThreadMock.mockResolvedValue(ok(undefined));
        generatePlainTextFromMessagesMock.mockResolvedValue(ok('Utility Generated Title'));
    }

    it('uses the Utility AI target for optional AI naming when available', async () => {
        arrangeCommonTitleMocks();
        resolveUtilityModelTargetMock.mockResolvedValue({
            providerId: 'zai',
            modelId: 'zai/glm-4.5-air',
            source: 'utility',
        });

        await threadTitleService.maybeApply({
            profileId: 'profile_test',
            sessionId: 'sess_test',
            prompt: 'Investigate compaction behavior.',
            providerId: 'openai',
            modelId: 'openai/gpt-5',
        });

        expect(resolveUtilityModelTargetMock).toHaveBeenCalledWith({
            profileId: 'profile_test',
            fallbackProviderId: 'openai',
            fallbackModelId: 'openai/gpt-5',
        });
        expect(generatePlainTextFromMessagesMock).toHaveBeenCalledWith(
            expect.objectContaining({
                profileId: 'profile_test',
                providerId: 'zai',
                modelId: 'zai/glm-4.5-air',
            })
        );
        expect(renameThreadMock).toHaveBeenNthCalledWith(2, 'profile_test', 'thr_test', 'Utility Generated Title');
    });

    it('falls back to the active run model when Utility AI is unavailable', async () => {
        arrangeCommonTitleMocks();
        resolveUtilityModelTargetMock.mockResolvedValue({
            providerId: 'openai',
            modelId: 'openai/gpt-5',
            source: 'fallback',
        });

        await threadTitleService.maybeApply({
            profileId: 'profile_test',
            sessionId: 'sess_test',
            prompt: 'Investigate compaction behavior.',
            providerId: 'openai',
            modelId: 'openai/gpt-5',
        });

        expect(generatePlainTextFromMessagesMock).toHaveBeenCalledWith(
            expect.objectContaining({
                profileId: 'profile_test',
                providerId: 'openai',
                modelId: 'openai/gpt-5',
            })
        );
        expect(renameThreadMock).toHaveBeenCalledTimes(2);
    });

    it('uses the active model directly when Conversation Naming is set to skip Utility AI', async () => {
        arrangeCommonTitleMocks();
        shouldUseUtilityModelMock.mockResolvedValue(false);

        await threadTitleService.maybeApply({
            profileId: 'profile_test',
            sessionId: 'sess_test',
            prompt: 'Investigate compaction behavior.',
            providerId: 'openai',
            modelId: 'openai/gpt-5',
        });

        expect(resolveUtilityModelTargetMock).not.toHaveBeenCalled();
        expect(generatePlainTextFromMessagesMock).toHaveBeenCalledWith(
            expect.objectContaining({
                profileId: 'profile_test',
                providerId: 'openai',
                modelId: 'openai/gpt-5',
            })
        );
    });
});
