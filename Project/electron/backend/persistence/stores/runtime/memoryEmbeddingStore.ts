import type { Kysely } from 'kysely';

import { getPersistence } from '@/app/backend/persistence/db';
import { parseEntityId, parseEnumValue } from '@/app/backend/persistence/stores/shared/rowParsers';
import { nowIso } from '@/app/backend/persistence/stores/shared/utils';
import type { DatabaseSchema } from '@/app/backend/persistence/schema';
import type { MemoryEmbeddingIndexRecord } from '@/app/backend/persistence/types';
import { createEntityId } from '@/app/backend/runtime/identity/entityIds';
import { providerIds, type RuntimeProviderId } from '@/shared/contracts';

function parseEmbedding(value: string): number[] {
    try {
        const parsed = JSON.parse(value) as unknown;
        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed.flatMap((entry) => (typeof entry === 'number' && Number.isFinite(entry) ? [entry] : []));
    } catch {
        return [];
    }
}

function mapMemoryEmbeddingIndexRecord(row: {
    id: string;
    profile_id: string;
    memory_id: string;
    provider_id: string;
    model_id: string;
    source_digest: string;
    indexed_text: string;
    embedding_json: string;
    dimensions: number;
    created_at: string;
    updated_at: string;
}): MemoryEmbeddingIndexRecord {
    return {
        id: parseEntityId(row.id, 'memory_embedding_records.id', 'mvec'),
        profileId: row.profile_id,
        memoryId: parseEntityId(row.memory_id, 'memory_embedding_records.memory_id', 'mem'),
        providerId: parseEnumValue(row.provider_id, 'memory_embedding_records.provider_id', providerIds),
        modelId: row.model_id,
        sourceDigest: row.source_digest,
        indexedText: row.indexed_text,
        embedding: parseEmbedding(row.embedding_json),
        dimensions: row.dimensions,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export class MemoryEmbeddingStore {
    private getDb(): Kysely<DatabaseSchema> {
        return getPersistence().db;
    }

    async upsert(input: {
        profileId: string;
        memoryId: string;
        providerId: RuntimeProviderId;
        modelId: string;
        sourceDigest: string;
        indexedText: string;
        embedding: number[];
    }): Promise<MemoryEmbeddingIndexRecord> {
        const timestamp = nowIso();
        await this.getDb()
            .insertInto('memory_embedding_records')
            .values({
                id: createEntityId('mvec'),
                profile_id: input.profileId,
                memory_id: input.memoryId,
                provider_id: input.providerId,
                model_id: input.modelId,
                source_digest: input.sourceDigest,
                indexed_text: input.indexedText,
                embedding_json: JSON.stringify(input.embedding),
                dimensions: input.embedding.length,
                created_at: timestamp,
                updated_at: timestamp,
            })
            .onConflict((conflict) =>
                conflict.columns(['profile_id', 'memory_id', 'provider_id', 'model_id']).doUpdateSet({
                    source_digest: input.sourceDigest,
                    indexed_text: input.indexedText,
                    embedding_json: JSON.stringify(input.embedding),
                    dimensions: input.embedding.length,
                    updated_at: timestamp,
                })
            )
            .execute();

        const row = await this.getDb()
            .selectFrom('memory_embedding_records')
            .selectAll()
            .where('profile_id', '=', input.profileId)
            .where('memory_id', '=', input.memoryId)
            .where('provider_id', '=', input.providerId)
            .where('model_id', '=', input.modelId)
            .executeTakeFirstOrThrow();

        return mapMemoryEmbeddingIndexRecord(row);
    }

    async getByMemoryId(input: {
        profileId: string;
        memoryId: string;
        providerId: RuntimeProviderId;
        modelId: string;
    }): Promise<MemoryEmbeddingIndexRecord | null> {
        const row = await this.getDb()
            .selectFrom('memory_embedding_records')
            .selectAll()
            .where('profile_id', '=', input.profileId)
            .where('memory_id', '=', input.memoryId)
            .where('provider_id', '=', input.providerId)
            .where('model_id', '=', input.modelId)
            .executeTakeFirst();

        return row ? mapMemoryEmbeddingIndexRecord(row) : null;
    }

    async listByProviderModel(input: {
        profileId: string;
        providerId: RuntimeProviderId;
        modelId: string;
    }): Promise<MemoryEmbeddingIndexRecord[]> {
        const rows = await this.getDb()
            .selectFrom('memory_embedding_records')
            .selectAll()
            .where('profile_id', '=', input.profileId)
            .where('provider_id', '=', input.providerId)
            .where('model_id', '=', input.modelId)
            .orderBy('updated_at', 'desc')
            .execute();

        return rows.map(mapMemoryEmbeddingIndexRecord);
    }

    async deleteByMemoryId(input: {
        profileId: string;
        memoryId: string;
        providerId?: RuntimeProviderId;
        modelId?: string;
    }): Promise<void> {
        let query = this.getDb()
            .deleteFrom('memory_embedding_records')
            .where('profile_id', '=', input.profileId)
            .where('memory_id', '=', input.memoryId);

        if (input.providerId) {
            query = query.where('provider_id', '=', input.providerId);
        }
        if (input.modelId) {
            query = query.where('model_id', '=', input.modelId);
        }

        await query.execute();
    }

    async clearProfileModel(input: { profileId: string; providerId: RuntimeProviderId; modelId: string }): Promise<void> {
        await this.getDb()
            .deleteFrom('memory_embedding_records')
            .where('profile_id', '=', input.profileId)
            .where('provider_id', '=', input.providerId)
            .where('model_id', '=', input.modelId)
            .execute();
    }
}

export const memoryEmbeddingStore = new MemoryEmbeddingStore();
