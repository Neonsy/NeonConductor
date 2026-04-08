import { settingsStore } from '@/app/backend/persistence/stores';
import type { UtilityModelConsumerPreference, UtilityModelConsumerPreferences } from '@/app/backend/runtime/contracts';
import type { UtilityModelConsumerId } from '@/shared/contracts';

const utilityModelConsumerSettingKeys: Record<UtilityModelConsumerId, string> = {
    conversation_naming: 'utility_model_consumer_conversation_naming',
    context_compaction: 'utility_model_consumer_context_compaction',
};

const utilityModelConsumerIds = Object.keys(utilityModelConsumerSettingKeys) as UtilityModelConsumerId[];

function parseStoredBoolean(value: string | undefined): boolean | undefined {
    if (value === '1' || value === 'true') {
        return true;
    }
    if (value === '0' || value === 'false') {
        return false;
    }

    return undefined;
}

function buildConsumerPreference(
    consumerId: UtilityModelConsumerId,
    storedValue: string | undefined
): UtilityModelConsumerPreference {
    return {
        consumerId,
        useUtilityModel: parseStoredBoolean(storedValue) ?? true,
    };
}

class UtilityModelConsumerPreferencesService {
    async getPreferences(profileId: string): Promise<UtilityModelConsumerPreferences> {
        const storedValues = await Promise.all(
            utilityModelConsumerIds.map((consumerId) =>
                settingsStore.getStringOptional(profileId, utilityModelConsumerSettingKeys[consumerId])
            )
        );

        return {
            preferences: utilityModelConsumerIds.map((consumerId, index) =>
                buildConsumerPreference(consumerId, storedValues[index])
            ),
        };
    }

    async setPreference(input: {
        profileId: string;
        consumerId: UtilityModelConsumerId;
        useUtilityModel: boolean;
    }): Promise<UtilityModelConsumerPreferences> {
        await settingsStore.setString(
            input.profileId,
            utilityModelConsumerSettingKeys[input.consumerId],
            input.useUtilityModel ? '1' : '0'
        );

        return this.getPreferences(input.profileId);
    }

    async shouldUseUtilityModel(profileId: string, consumerId: UtilityModelConsumerId): Promise<boolean> {
        const storedValue = await settingsStore.getStringOptional(
            profileId,
            utilityModelConsumerSettingKeys[consumerId]
        );
        return parseStoredBoolean(storedValue) ?? true;
    }
}

export const utilityModelConsumerPreferencesService = new UtilityModelConsumerPreferencesService();
