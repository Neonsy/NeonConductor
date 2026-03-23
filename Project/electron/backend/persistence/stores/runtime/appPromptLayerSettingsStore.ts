import { getPersistence } from '@/app/backend/persistence/db';
import { nowIso } from '@/app/backend/persistence/stores/shared/utils';
import type { AppPromptLayerSettingsRecord } from '@/app/backend/persistence/types';

const GLOBAL_PROMPT_LAYER_SETTINGS_ID = 'global';

function mapAppPromptLayerSettings(row: {
    id: string;
    global_instructions: string;
    updated_at: string;
}): AppPromptLayerSettingsRecord {
    return {
        globalInstructions: row.global_instructions,
        updatedAt: row.updated_at,
    };
}

export class AppPromptLayerSettingsStore {
    async get(): Promise<AppPromptLayerSettingsRecord> {
        const { db } = getPersistence();
        const row = await db
            .selectFrom('app_prompt_layer_settings')
            .select(['id', 'global_instructions', 'updated_at'])
            .where('id', '=', GLOBAL_PROMPT_LAYER_SETTINGS_ID)
            .executeTakeFirst();

        if (row) {
            return mapAppPromptLayerSettings(row);
        }

        const updatedAt = nowIso();
        await db
            .insertInto('app_prompt_layer_settings')
            .values({
                id: GLOBAL_PROMPT_LAYER_SETTINGS_ID,
                global_instructions: '',
                updated_at: updatedAt,
            })
            .execute();

        return {
            globalInstructions: '',
            updatedAt,
        };
    }

    async setGlobalInstructions(globalInstructions: string): Promise<AppPromptLayerSettingsRecord> {
        const { db } = getPersistence();
        const updatedAt = nowIso();

        await db
            .insertInto('app_prompt_layer_settings')
            .values({
                id: GLOBAL_PROMPT_LAYER_SETTINGS_ID,
                global_instructions: globalInstructions,
                updated_at: updatedAt,
            })
            .onConflict((oc) =>
                oc.column('id').doUpdateSet({
                    global_instructions: globalInstructions,
                    updated_at: updatedAt,
                })
            )
            .execute();

        return {
            globalInstructions,
            updatedAt,
        };
    }
}

export const appPromptLayerSettingsStore = new AppPromptLayerSettingsStore();
