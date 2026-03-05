import { getPersistence } from '@/app/backend/persistence/db';
import { parseJsonValue } from '@/app/backend/persistence/stores/utils';
import type { ModeDefinitionRecord } from '@/app/backend/persistence/types';
import type { ModeExecutionPolicy, TopLevelTab } from '@/app/backend/runtime/contracts';

function parseExecutionPolicy(value: string): ModeExecutionPolicy {
    const parsed = parseJsonValue<Record<string, unknown>>(value, {});
    const planningOnly = parsed['planningOnly'];
    const readOnly = parsed['readOnly'];

    return {
        ...(typeof planningOnly === 'boolean' ? { planningOnly } : {}),
        ...(typeof readOnly === 'boolean' ? { readOnly } : {}),
    };
}

function mapModeDefinition(row: {
    id: string;
    profile_id: string;
    top_level_tab: string;
    mode_key: string;
    label: string;
    prompt_json: string;
    execution_policy_json: string;
    source: string;
    enabled: 0 | 1;
    created_at: string;
    updated_at: string;
}): ModeDefinitionRecord {
    return {
        id: row.id,
        profileId: row.profile_id,
        topLevelTab: row.top_level_tab as TopLevelTab,
        modeKey: row.mode_key,
        label: row.label,
        prompt: parseJsonValue(row.prompt_json, {}),
        executionPolicy: parseExecutionPolicy(row.execution_policy_json),
        source: row.source,
        enabled: row.enabled === 1,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export class ModeStore {
    async getByProfileTabMode(
        profileId: string,
        topLevelTab: TopLevelTab,
        modeKey: string
    ): Promise<ModeDefinitionRecord | null> {
        const { db } = getPersistence();
        const row = await db
            .selectFrom('mode_definitions')
            .select([
                'id',
                'profile_id',
                'top_level_tab',
                'mode_key',
                'label',
                'prompt_json',
                'execution_policy_json',
                'source',
                'enabled',
                'created_at',
                'updated_at',
            ])
            .where('profile_id', '=', profileId)
            .where('top_level_tab', '=', topLevelTab)
            .where('mode_key', '=', modeKey)
            .executeTakeFirst();

        return row ? mapModeDefinition(row) : null;
    }

    async listByProfileAndTab(profileId: string, topLevelTab: TopLevelTab): Promise<ModeDefinitionRecord[]> {
        const all = await this.listByProfile(profileId);
        return all.filter((mode) => mode.topLevelTab === topLevelTab);
    }

    async listByProfile(profileId: string): Promise<ModeDefinitionRecord[]> {
        const { db } = getPersistence();
        const rows = await db
            .selectFrom('mode_definitions')
            .select([
                'id',
                'profile_id',
                'top_level_tab',
                'mode_key',
                'label',
                'prompt_json',
                'execution_policy_json',
                'source',
                'enabled',
                'created_at',
                'updated_at',
            ])
            .where('profile_id', '=', profileId)
            .orderBy('top_level_tab', 'asc')
            .orderBy('mode_key', 'asc')
            .execute();

        return rows.map(mapModeDefinition);
    }
}

export const modeStore = new ModeStore();
