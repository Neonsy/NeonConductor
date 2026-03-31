import type { Kysely, Transaction } from 'kysely';

import { getPersistence } from '@/app/backend/persistence/db';
import type { DatabaseSchema } from '@/app/backend/persistence/schema';
import { parseEntityId, parseEnumValue } from '@/app/backend/persistence/stores/shared/rowParsers';
import { nowIso } from '@/app/backend/persistence/stores/shared/utils';
import type { MemoryRevisionRecord } from '@/app/backend/persistence/types';
import { memoryRevisionReasons, type EntityId } from '@/app/backend/runtime/contracts';
import { createEntityId } from '@/app/backend/runtime/identity/entityIds';

type MemoryRevisionStoreDb = Kysely<DatabaseSchema> | Transaction<DatabaseSchema>;

function mapMemoryRevisionRecord(row: {
    id: string;
    profile_id: string;
    previous_memory_id: string;
    replacement_memory_id: string;
    revision_reason: string;
    created_at: string;
}): MemoryRevisionRecord {
    return {
        id: parseEntityId(row.id, 'memory_revision_records.id', 'mrev'),
        profileId: row.profile_id,
        previousMemoryId: parseEntityId(row.previous_memory_id, 'memory_revision_records.previous_memory_id', 'mem'),
        replacementMemoryId: parseEntityId(
            row.replacement_memory_id,
            'memory_revision_records.replacement_memory_id',
            'mem'
        ),
        revisionReason: parseEnumValue(
            row.revision_reason,
            'memory_revision_records.revision_reason',
            memoryRevisionReasons
        ),
        createdAt: row.created_at,
    };
}

export class MemoryRevisionStore {
    private getDb(): Kysely<DatabaseSchema> {
        return getPersistence().db;
    }

    async createInTransaction(
        db: MemoryRevisionStoreDb,
        input: {
            profileId: string;
            previousMemoryId: EntityId<'mem'>;
            replacementMemoryId: EntityId<'mem'>;
            revisionReason: MemoryRevisionRecord['revisionReason'];
        }
    ): Promise<MemoryRevisionRecord> {
        const createdAt = nowIso();
        const inserted = await db
            .insertInto('memory_revision_records')
            .values({
                id: createEntityId('mrev'),
                profile_id: input.profileId,
                previous_memory_id: input.previousMemoryId,
                replacement_memory_id: input.replacementMemoryId,
                revision_reason: input.revisionReason,
                created_at: createdAt,
            })
            .returningAll()
            .executeTakeFirstOrThrow();

        return mapMemoryRevisionRecord(inserted);
    }

    async getByPreviousMemoryId(
        profileId: string,
        previousMemoryId: EntityId<'mem'>
    ): Promise<MemoryRevisionRecord | null> {
        const row = await this.getDb()
            .selectFrom('memory_revision_records')
            .selectAll()
            .where('profile_id', '=', profileId)
            .where('previous_memory_id', '=', previousMemoryId)
            .executeTakeFirst();

        return row ? mapMemoryRevisionRecord(row) : null;
    }

    async getByReplacementMemoryId(
        profileId: string,
        replacementMemoryId: EntityId<'mem'>
    ): Promise<MemoryRevisionRecord | null> {
        const row = await this.getDb()
            .selectFrom('memory_revision_records')
            .selectAll()
            .where('profile_id', '=', profileId)
            .where('replacement_memory_id', '=', replacementMemoryId)
            .executeTakeFirst();

        return row ? mapMemoryRevisionRecord(row) : null;
    }

    async listByMemoryIds(profileId: string, memoryIds: EntityId<'mem'>[]): Promise<MemoryRevisionRecord[]> {
        if (memoryIds.length === 0) {
            return [];
        }

        const rows = await this.getDb()
            .selectFrom('memory_revision_records')
            .selectAll()
            .where('profile_id', '=', profileId)
            .where(({ eb, or }) =>
                or([
                    eb('previous_memory_id', 'in', memoryIds),
                    eb('replacement_memory_id', 'in', memoryIds),
                ])
            )
            .orderBy('created_at', 'desc')
            .execute();

        return rows.map(mapMemoryRevisionRecord);
    }
}

export const memoryRevisionStore = new MemoryRevisionStore();
