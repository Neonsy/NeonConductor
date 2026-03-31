import type { Kysely } from 'kysely';

import { getPersistence } from '@/app/backend/persistence/db';
import { parseEnumValue, parseJsonRecord } from '@/app/backend/persistence/stores/shared/rowParsers';
import { nowIso } from '@/app/backend/persistence/stores/shared/utils';
import type { DatabaseSchema } from '@/app/backend/persistence/schema';
import type { ProviderEmbeddingModelRecord } from '@/app/backend/persistence/types';
import { providerIds, type RuntimeProviderId } from '@/app/backend/runtime/contracts';

interface ProviderEmbeddingModelUpsert {
    id: string;
    providerId: RuntimeProviderId;
    label: string;
    dimensions: number;
    maxInputTokens?: number;
    inputPrice?: number;
    source?: string;
    raw?: Record<string, unknown>;
}

function mapProviderEmbeddingModelRecord(row: {
    model_id: string;
    provider_id: string;
    label: string;
    dimensions: number;
    max_input_tokens: number | null;
    input_price: number | null;
    source: string;
    updated_at: string;
    raw_json: string;
}): ProviderEmbeddingModelRecord {
    return {
        id: row.model_id,
        providerId: parseEnumValue(row.provider_id, 'provider_embedding_model_catalog.provider_id', providerIds),
        label: row.label,
        dimensions: row.dimensions,
        ...(row.max_input_tokens !== null ? { maxInputTokens: row.max_input_tokens } : {}),
        ...(row.input_price !== null ? { inputPrice: row.input_price } : {}),
        source: row.source,
        updatedAt: row.updated_at,
        raw: parseJsonRecord(row.raw_json),
    };
}

export class ProviderEmbeddingCatalogStore {
    private getDb(): Kysely<DatabaseSchema> {
        return getPersistence().db;
    }

    async listModels(profileId: string, providerId: RuntimeProviderId): Promise<ProviderEmbeddingModelRecord[]> {
        const rows = await this.getDb()
            .selectFrom('provider_embedding_model_catalog')
            .selectAll()
            .where('profile_id', '=', profileId)
            .where('provider_id', '=', providerId)
            .orderBy('label', 'asc')
            .execute();

        return rows.map(mapProviderEmbeddingModelRecord);
    }

    async listByProfile(profileId: string): Promise<ProviderEmbeddingModelRecord[]> {
        const rows = await this.getDb()
            .selectFrom('provider_embedding_model_catalog')
            .selectAll()
            .where('profile_id', '=', profileId)
            .orderBy('provider_id', 'asc')
            .orderBy('label', 'asc')
            .execute();

        return rows.map(mapProviderEmbeddingModelRecord);
    }

    async replaceModels(
        profileId: string,
        providerId: RuntimeProviderId,
        models: ProviderEmbeddingModelUpsert[]
    ): Promise<{ modelCount: number; changed: boolean }> {
        const { db } = getPersistence();
        const updatedAt = nowIso();

        const existingRows = await db
            .selectFrom('provider_embedding_model_catalog')
            .select([
                'model_id',
                'provider_id',
                'label',
                'dimensions',
                'max_input_tokens',
                'input_price',
                'source',
                'raw_json',
            ])
            .where('profile_id', '=', profileId)
            .where('provider_id', '=', providerId)
            .execute();

        const existingSerialized = JSON.stringify(
            existingRows
                .map((row) => ({
                    id: row.model_id,
                    providerId: row.provider_id,
                    label: row.label,
                    dimensions: row.dimensions,
                    maxInputTokens: row.max_input_tokens,
                    inputPrice: row.input_price,
                    source: row.source,
                    raw: row.raw_json,
                }))
                .sort((left, right) => left.id.localeCompare(right.id))
        );
        const nextSerialized = JSON.stringify(
            models
                .map((model) => ({
                    id: model.id,
                    providerId: model.providerId,
                    label: model.label,
                    dimensions: model.dimensions,
                    maxInputTokens: model.maxInputTokens ?? null,
                    inputPrice: model.inputPrice ?? null,
                    source: model.source ?? 'static_embedding_registry',
                    raw: JSON.stringify(model.raw ?? {}),
                }))
                .sort((left, right) => left.id.localeCompare(right.id))
        );
        if (existingSerialized === nextSerialized) {
            return {
                modelCount: models.length,
                changed: false,
            };
        }

        await db
            .deleteFrom('provider_embedding_model_catalog')
            .where('profile_id', '=', profileId)
            .where('provider_id', '=', providerId)
            .execute();

        if (models.length === 0) {
            return {
                modelCount: 0,
                changed: true,
            };
        }

        await db
            .insertInto('provider_embedding_model_catalog')
            .values(
                models.map((model) => ({
                    profile_id: profileId,
                    provider_id: providerId,
                    model_id: model.id,
                    label: model.label,
                    dimensions: model.dimensions,
                    max_input_tokens: model.maxInputTokens ?? null,
                    input_price: model.inputPrice ?? null,
                    source: model.source ?? 'static_embedding_registry',
                    updated_at: updatedAt,
                    raw_json: JSON.stringify(model.raw ?? {}),
                }))
            )
            .execute();

        return {
            modelCount: models.length,
            changed: true,
        };
    }

    async clearModels(profileId: string, providerId: RuntimeProviderId): Promise<void> {
        await this.getDb()
            .deleteFrom('provider_embedding_model_catalog')
            .where('profile_id', '=', profileId)
            .where('provider_id', '=', providerId)
            .execute();
    }

    async modelExists(profileId: string, providerId: RuntimeProviderId, modelId: string): Promise<boolean> {
        const row = await this.getDb()
            .selectFrom('provider_embedding_model_catalog')
            .select('model_id')
            .where('profile_id', '=', profileId)
            .where('provider_id', '=', providerId)
            .where('model_id', '=', modelId)
            .executeTakeFirst();

        return Boolean(row);
    }

    async getModel(
        profileId: string,
        providerId: RuntimeProviderId,
        modelId: string
    ): Promise<ProviderEmbeddingModelRecord | null> {
        const row = await this.getDb()
            .selectFrom('provider_embedding_model_catalog')
            .selectAll()
            .where('profile_id', '=', profileId)
            .where('provider_id', '=', providerId)
            .where('model_id', '=', modelId)
            .executeTakeFirst();

        return row
            ? mapProviderEmbeddingModelRecord({
                  model_id: row.model_id,
                  provider_id: row.provider_id,
                  label: row.label,
                  dimensions: row.dimensions,
                  max_input_tokens: row.max_input_tokens,
                  input_price: row.input_price,
                  source: row.source,
                  updated_at: row.updated_at,
                  raw_json: row.raw_json,
              })
            : null;
    }
}

export const providerEmbeddingCatalogStore = new ProviderEmbeddingCatalogStore();
