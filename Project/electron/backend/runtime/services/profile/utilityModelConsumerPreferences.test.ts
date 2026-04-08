import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getStringOptionalMock, setStringMock } = vi.hoisted(() => ({
    getStringOptionalMock: vi.fn(),
    setStringMock: vi.fn(),
}));

vi.mock('@/app/backend/persistence/stores', () => ({
    settingsStore: {
        getStringOptional: getStringOptionalMock,
        setString: setStringMock,
    },
}));

import { utilityModelConsumerPreferencesService } from '@/app/backend/runtime/services/profile/utilityModelConsumerPreferences';

describe('utilityModelConsumerPreferencesService', () => {
    beforeEach(() => {
        getStringOptionalMock.mockReset();
        setStringMock.mockReset();
    });

    it('defaults both Utility AI consumers to on when no settings are stored', async () => {
        getStringOptionalMock.mockResolvedValue(undefined);

        await expect(utilityModelConsumerPreferencesService.getPreferences('profile_test')).resolves.toEqual({
            preferences: [
                { consumerId: 'conversation_naming', useUtilityModel: true },
                { consumerId: 'context_compaction', useUtilityModel: true },
            ],
        });
    });

    it('persists and rehydrates an explicit consumer preference', async () => {
        setStringMock.mockResolvedValue(undefined);
        getStringOptionalMock.mockResolvedValueOnce('0').mockResolvedValueOnce(undefined);

        await expect(
            utilityModelConsumerPreferencesService.setPreference({
                profileId: 'profile_test',
                consumerId: 'conversation_naming',
                useUtilityModel: false,
            })
        ).resolves.toEqual({
            preferences: [
                { consumerId: 'conversation_naming', useUtilityModel: false },
                { consumerId: 'context_compaction', useUtilityModel: true },
            ],
        });

        expect(setStringMock).toHaveBeenCalledWith('profile_test', 'utility_model_consumer_conversation_naming', '0');
    });

    it('returns the default-on value when a stored consumer flag is invalid', async () => {
        getStringOptionalMock.mockResolvedValue('invalid');

        await expect(
            utilityModelConsumerPreferencesService.shouldUseUtilityModel('profile_test', 'context_compaction')
        ).resolves.toBe(true);
    });
});
