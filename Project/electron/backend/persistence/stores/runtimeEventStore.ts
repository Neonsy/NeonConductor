import { getPersistence } from '@/app/backend/persistence/db';
import { parseEntityId, parseEnumValue, parseJsonRecord } from '@/app/backend/persistence/stores/rowParsers';
import { nowIso } from '@/app/backend/persistence/stores/utils';
import type { RuntimeEntityType, RuntimeEventRecordV1 } from '@/app/backend/persistence/types';
import { createEntityId } from '@/app/backend/runtime/contracts';

const runtimeEntityTypes = [
    'session',
    'run',
    'profile',
    'permission',
    'provider',
    'tool',
    'mcp',
    'runtime',
    'conversation',
    'thread',
    'tag',
    'diff',
    'plan',
    'orchestrator',
] as const;

export class RuntimeEventStore {
    async append(event: {
        entityType: RuntimeEntityType;
        entityId: string;
        eventType: string;
        payload: Record<string, unknown>;
    }): Promise<RuntimeEventRecordV1> {
        const { db } = getPersistence();
        const createdAt = nowIso();
        const eventId = createEntityId('evt');

        const inserted = await db
            .insertInto('runtime_events')
            .values({
                event_id: eventId,
                entity_type: event.entityType,
                entity_id: event.entityId,
                event_type: event.eventType,
                payload_json: JSON.stringify(event.payload),
                created_at: createdAt,
            })
            .returning(['sequence', 'event_id', 'entity_type', 'entity_id', 'event_type', 'payload_json', 'created_at'])
            .executeTakeFirstOrThrow();

        return {
            sequence: inserted.sequence,
            eventId: parseEntityId(inserted.event_id, 'runtime_events.event_id', 'evt'),
            entityType: parseEnumValue(inserted.entity_type, 'runtime_events.entity_type', runtimeEntityTypes),
            entityId: inserted.entity_id,
            eventType: inserted.event_type,
            payload: parseJsonRecord(inserted.payload_json),
            createdAt: inserted.created_at,
        };
    }

    async list(afterSequence: number | null, limit: number): Promise<RuntimeEventRecordV1[]> {
        const { db } = getPersistence();

        let query = db
            .selectFrom('runtime_events')
            .select(['sequence', 'event_id', 'entity_type', 'entity_id', 'event_type', 'payload_json', 'created_at'])
            .orderBy('sequence', 'asc')
            .limit(limit);

        if (typeof afterSequence === 'number') {
            query = query.where('sequence', '>', afterSequence);
        }

        const rows = await query.execute();

        return rows.map((row) => ({
            sequence: row.sequence,
            eventId: parseEntityId(row.event_id, 'runtime_events.event_id', 'evt'),
            entityType: parseEnumValue(row.entity_type, 'runtime_events.entity_type', runtimeEntityTypes),
            entityId: row.entity_id,
            eventType: row.event_type,
            payload: parseJsonRecord(row.payload_json),
            createdAt: row.created_at,
        }));
    }

    async getLastSequence(): Promise<number> {
        const { db } = getPersistence();

        const result = await db
            .selectFrom('runtime_events')
            .select((eb) => eb.fn.max<number>('sequence').as('last_sequence'))
            .executeTakeFirst();

        return result?.last_sequence ?? 0;
    }
}

export const runtimeEventStore = new RuntimeEventStore();
