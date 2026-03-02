import { createEntityId } from '@/app/backend/runtime/contracts';
import { getGlobalProfileId, getPersistence } from '@/app/backend/persistence/db';
import { nowIso, parseJsonValue } from '@/app/backend/persistence/stores/utils';

export class SettingsStore {
    async getString(key: string, fallback: string): Promise<string> {
        const { db } = getPersistence();

        const row = await db
            .selectFrom('settings')
            .select(['value_json'])
            .where('profile_id', '=', getGlobalProfileId())
            .where('key', '=', key)
            .executeTakeFirst();

        if (!row) {
            return fallback;
        }

        return parseJsonValue(row.value_json, fallback);
    }

    async setString(key: string, value: string): Promise<void> {
        const { db } = getPersistence();

        await db
            .insertInto('settings')
            .values({
                id: createEntityId('tag'),
                profile_id: getGlobalProfileId(),
                key,
                value_json: JSON.stringify(value),
                updated_at: nowIso(),
            })
            .onConflict((oc) =>
                oc.columns(['profile_id', 'key']).doUpdateSet({
                    value_json: JSON.stringify(value),
                    updated_at: nowIso(),
                })
            )
            .execute();
    }
}

export const settingsStore = new SettingsStore();

