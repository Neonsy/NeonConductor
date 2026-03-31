import type { Kysely, Transaction } from 'kysely';

import { getPersistence } from '@/app/backend/persistence/db';
import { parseEntityId, parseEnumValue, parseJsonRecord } from '@/app/backend/persistence/stores/shared/rowParsers';
import { nowIso } from '@/app/backend/persistence/stores/shared/utils';
import type { DatabaseSchema } from '@/app/backend/persistence/schema';
import type { MemoryEvidenceRecord } from '@/app/backend/persistence/types';
import { createEntityId } from '@/app/backend/runtime/identity/entityIds';

const memoryEvidenceKinds = ['run', 'message', 'message_part', 'tool_result_artifact'] as const;

function mapMemoryEvidenceRecord(row: {
    id: string;
    profile_id: string;
    memory_id: string;
    sequence: number;
    evidence_kind: string;
    label: string;
    excerpt_text: string | null;
    source_run_id: string | null;
    source_message_id: string | null;
    source_message_part_id: string | null;
    metadata_json: string;
    created_at: string;
}): MemoryEvidenceRecord {
    return {
        id: parseEntityId(row.id, 'memory_evidence_records.id', 'mev'),
        profileId: row.profile_id,
        memoryId: parseEntityId(row.memory_id, 'memory_evidence_records.memory_id', 'mem'),
        sequence: row.sequence,
        kind: parseEnumValue(row.evidence_kind, 'memory_evidence_records.evidence_kind', memoryEvidenceKinds),
        label: row.label,
        ...(row.excerpt_text ? { excerptText: row.excerpt_text } : {}),
        ...(row.source_run_id
            ? { sourceRunId: parseEntityId(row.source_run_id, 'memory_evidence_records.source_run_id', 'run') }
            : {}),
        ...(row.source_message_id
            ? {
                  sourceMessageId: parseEntityId(
                      row.source_message_id,
                      'memory_evidence_records.source_message_id',
                      'msg'
                  ),
              }
            : {}),
        ...(row.source_message_part_id
            ? {
                  sourceMessagePartId: parseEntityId(
                      row.source_message_part_id,
                      'memory_evidence_records.source_message_part_id',
                      'part'
                  ),
              }
            : {}),
        metadata: parseJsonRecord(row.metadata_json),
        createdAt: row.created_at,
    };
}

interface CreateMemoryEvidenceInput {
    profileId: string;
    memoryId: string;
    sequence: number;
    kind: MemoryEvidenceRecord['kind'];
    label: string;
    excerptText?: string;
    sourceRunId?: string;
    sourceMessageId?: string;
    sourceMessagePartId?: string;
    metadata?: Record<string, unknown>;
}

export class MemoryEvidenceStore {
    private getDb(): Kysely<DatabaseSchema> {
        return getPersistence().db;
    }

    async createManyInTransaction(
        db: Transaction<DatabaseSchema>,
        input: {
            profileId: string;
            memoryId: string;
            evidence: Omit<CreateMemoryEvidenceInput, 'profileId' | 'memoryId' | 'sequence'>[];
        }
    ): Promise<MemoryEvidenceRecord[]> {
        const createdAt = nowIso();
        const createdRows = await Promise.all(
            input.evidence.map(async (evidence, index) => {
                const row = await db
                    .insertInto('memory_evidence_records')
                    .values({
                        id: createEntityId('mev'),
                        profile_id: input.profileId,
                        memory_id: input.memoryId,
                        sequence: index,
                        evidence_kind: evidence.kind,
                        label: evidence.label,
                        excerpt_text: evidence.excerptText ?? null,
                        source_run_id: evidence.sourceRunId ?? null,
                        source_message_id: evidence.sourceMessageId ?? null,
                        source_message_part_id: evidence.sourceMessagePartId ?? null,
                        metadata_json: JSON.stringify(evidence.metadata ?? {}),
                        created_at: createdAt,
                    })
                    .returningAll()
                    .executeTakeFirstOrThrow();

                return mapMemoryEvidenceRecord(row);
            })
        );

        return createdRows.sort((left, right) => left.sequence - right.sequence);
    }

    async listByMemoryIds(profileId: string, memoryIds: string[]): Promise<MemoryEvidenceRecord[]> {
        if (memoryIds.length === 0) {
            return [];
        }

        const rows = await this.getDb()
            .selectFrom('memory_evidence_records')
            .selectAll()
            .where('profile_id', '=', profileId)
            .where('memory_id', 'in', memoryIds)
            .orderBy('memory_id', 'asc')
            .orderBy('sequence', 'asc')
            .execute();

        return rows.map(mapMemoryEvidenceRecord);
    }

    async listByMemoryId(profileId: string, memoryId: string): Promise<MemoryEvidenceRecord[]> {
        return (await this.listByMemoryIds(profileId, [memoryId])).filter((record) => record.memoryId === memoryId);
    }
}

export const memoryEvidenceStore = new MemoryEvidenceStore();
