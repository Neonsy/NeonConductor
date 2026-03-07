import { getPersistence } from '@/app/backend/persistence/db';
import { parseEntityId } from '@/app/backend/persistence/stores/rowParsers';
import { nowIso } from '@/app/backend/persistence/stores/utils';
import type { SessionAttachedSkillRecord } from '@/app/backend/persistence/types';
import type { EntityId } from '@/app/backend/runtime/contracts';

function mapSessionAttachedSkill(row: {
    session_id: string;
    profile_id: string;
    asset_key: string;
    created_at: string;
}): SessionAttachedSkillRecord {
    return {
        sessionId: parseEntityId(row.session_id, 'session_attached_skills.session_id', 'sess'),
        profileId: row.profile_id,
        assetKey: row.asset_key,
        createdAt: row.created_at,
    };
}

export class SessionAttachedSkillStore {
    async listBySession(profileId: string, sessionId: EntityId<'sess'>): Promise<SessionAttachedSkillRecord[]> {
        const { db } = getPersistence();
        const rows = await db
            .selectFrom('session_attached_skills')
            .select(['session_id', 'profile_id', 'asset_key', 'created_at'])
            .where('profile_id', '=', profileId)
            .where('session_id', '=', sessionId)
            .orderBy('created_at', 'asc')
            .orderBy('asset_key', 'asc')
            .execute();

        return rows.map(mapSessionAttachedSkill);
    }

    async replaceForSession(input: {
        profileId: string;
        sessionId: EntityId<'sess'>;
        assetKeys: string[];
    }): Promise<SessionAttachedSkillRecord[]> {
        const { db } = getPersistence();
        const baseTime = Date.parse(nowIso());
        const assetKeys = Array.from(
            new Set(input.assetKeys.map((assetKey) => assetKey.trim()).filter((assetKey) => assetKey.length > 0))
        );

        await db
            .deleteFrom('session_attached_skills')
            .where('profile_id', '=', input.profileId)
            .where('session_id', '=', input.sessionId)
            .execute();

        if (assetKeys.length === 0) {
            return [];
        }

        await db
            .insertInto('session_attached_skills')
            .values(
                assetKeys.map((assetKey, index) => ({
                    session_id: input.sessionId,
                    profile_id: input.profileId,
                    asset_key: assetKey,
                    created_at: new Date(baseTime + index).toISOString(),
                }))
            )
            .execute();

        return this.listBySession(input.profileId, input.sessionId);
    }
}

export const sessionAttachedSkillStore = new SessionAttachedSkillStore();
