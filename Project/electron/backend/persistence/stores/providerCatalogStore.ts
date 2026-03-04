import { getPersistence } from '@/app/backend/persistence/db';
import { nowIso, parseJsonValue } from '@/app/backend/persistence/stores/utils';
import type { ProviderDiscoverySnapshotRecord, ProviderModelRecord } from '@/app/backend/persistence/types';
import type { ProviderModelCapabilities, ProviderModelModality } from '@/app/backend/providers/types';
import type { RuntimeProviderId } from '@/app/backend/runtime/contracts';

export interface ProviderCatalogModelUpsert {
    modelId: string;
    label: string;
    upstreamProvider?: string;
    isFree?: boolean;
    supportsTools?: boolean;
    supportsReasoning?: boolean;
    supportsVision?: boolean;
    supportsAudioInput?: boolean;
    supportsAudioOutput?: boolean;
    inputModalities?: ProviderModelModality[];
    outputModalities?: ProviderModelModality[];
    promptFamily?: string;
    contextLength?: number;
    pricing?: Record<string, unknown>;
    raw?: Record<string, unknown>;
    source: string;
}

interface ComparableCatalogModel {
    modelId: string;
    label: string;
    upstreamProvider: string | null;
    isFree: boolean;
    supportsTools: boolean;
    supportsReasoning: boolean;
    supportsVision: boolean;
    supportsAudioInput: boolean;
    supportsAudioOutput: boolean;
    inputModalities: ProviderModelModality[];
    outputModalities: ProviderModelModality[];
    promptFamily: string | null;
    contextLength: number | null;
    pricing: Record<string, unknown>;
    raw: Record<string, unknown>;
    source: string;
}

export interface ReplaceCatalogModelsResult {
    modelCount: number;
    changed: boolean;
}

const modelModalities: readonly ProviderModelModality[] = ['text', 'audio', 'image', 'video', 'pdf'];

function isModelModality(value: unknown): value is ProviderModelModality {
    return typeof value === 'string' && modelModalities.includes(value as ProviderModelModality);
}

function normalizeModalities(input?: ProviderModelModality[]): ProviderModelModality[] {
    if (!input || input.length === 0) {
        return ['text'];
    }

    const normalized = input.filter((modality) => modelModalities.includes(modality));
    if (!normalized.includes('text')) {
        normalized.unshift('text');
    }

    return Array.from(new Set(normalized));
}

function parseModalities(value: string | null): ProviderModelModality[] {
    if (value === null) {
        return ['text'];
    }

    const parsed = parseJsonValue<unknown[]>(value, []);
    if (!Array.isArray(parsed)) {
        return ['text'];
    }

    const normalized = parsed.filter(isModelModality);
    if (!normalized.includes('text')) {
        normalized.unshift('text');
    }

    return Array.from(new Set(normalized));
}

function mapModel(row: {
    model_id: string;
    provider_id: string;
    label: string;
    upstream_provider: string | null;
    supports_tools: 0 | 1;
    supports_reasoning: 0 | 1;
    supports_vision: 0 | 1 | null;
    supports_audio_input: 0 | 1 | null;
    supports_audio_output: 0 | 1 | null;
    pricing_json: string;
    raw_json: string;
    input_modalities_json: string | null;
    output_modalities_json: string | null;
    prompt_family: string | null;
}): ProviderModelRecord {
    const inputModalities = parseModalities(row.input_modalities_json);
    const outputModalities = parseModalities(row.output_modalities_json);
    const pricing = parseJsonValue<Record<string, unknown>>(row.pricing_json, {});
    const raw = parseJsonValue<Record<string, unknown>>(row.raw_json, {});
    const price = extractPrice(pricing, raw);
    const latency = extractLatency(raw);
    const tps = extractTps(raw);

    return {
        id: row.model_id,
        providerId: row.provider_id as RuntimeProviderId,
        label: row.label,
        ...(row.upstream_provider ? { sourceProvider: row.upstream_provider } : {}),
        supportsTools: row.supports_tools === 1,
        supportsReasoning: row.supports_reasoning === 1,
        supportsVision: row.supports_vision === null ? inputModalities.includes('image') : row.supports_vision === 1,
        supportsAudioInput:
            row.supports_audio_input === null ? inputModalities.includes('audio') : row.supports_audio_input === 1,
        supportsAudioOutput:
            row.supports_audio_output === null ? outputModalities.includes('audio') : row.supports_audio_output === 1,
        inputModalities,
        outputModalities,
        ...(row.prompt_family ? { promptFamily: row.prompt_family } : {}),
        ...(price !== undefined ? { price } : {}),
        ...(latency !== undefined ? { latency } : {}),
        ...(tps !== undefined ? { tps } : {}),
    };
}

function readNumberFromRecord(source: Record<string, unknown>, key: string): number | undefined {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === 'string') {
        const normalized = Number.parseFloat(value);
        if (Number.isFinite(normalized)) {
            return normalized;
        }
    }

    return undefined;
}

function readNestedRecord(source: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
    const value = source[key];
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function extractPrice(pricing: Record<string, unknown>, raw: Record<string, unknown>): number | undefined {
    const directKeys = ['price', 'cost', 'price_usd', 'usd'];
    for (const key of directKeys) {
        const value = readNumberFromRecord(pricing, key);
        if (value !== undefined) {
            return value;
        }
    }

    const nestedPricing = readNestedRecord(raw, 'pricing');
    if (nestedPricing) {
        for (const key of directKeys) {
            const value = readNumberFromRecord(nestedPricing, key);
            if (value !== undefined) {
                return value;
            }
        }
    }

    return undefined;
}

function extractLatency(raw: Record<string, unknown>): number | undefined {
    const performance = readNestedRecord(raw, 'performance');
    const keys = ['latency', 'latency_ms', 'avg_latency', 'avg_latency_ms'];
    for (const key of keys) {
        const direct = readNumberFromRecord(raw, key);
        if (direct !== undefined) {
            return direct;
        }
        if (performance) {
            const nested = readNumberFromRecord(performance, key);
            if (nested !== undefined) {
                return nested;
            }
        }
    }

    return undefined;
}

function extractTps(raw: Record<string, unknown>): number | undefined {
    const performance = readNestedRecord(raw, 'performance');
    const keys = ['tps', 'tokens_per_second', 'throughput_tps', 'avg_tps'];
    for (const key of keys) {
        const direct = readNumberFromRecord(raw, key);
        if (direct !== undefined) {
            return direct;
        }
        if (performance) {
            const nested = readNumberFromRecord(performance, key);
            if (nested !== undefined) {
                return nested;
            }
        }
    }

    return undefined;
}

function compareByKiloRanking(left: ProviderModelRecord, right: ProviderModelRecord): number {
    const leftPrice = left.price;
    const rightPrice = right.price;
    if (leftPrice !== undefined && rightPrice !== undefined && leftPrice !== rightPrice) {
        return leftPrice - rightPrice;
    }

    const leftLatency = left.latency;
    const rightLatency = right.latency;
    if (leftLatency !== undefined && rightLatency !== undefined && leftLatency !== rightLatency) {
        return leftLatency - rightLatency;
    }

    const leftTps = left.tps;
    const rightTps = right.tps;
    if (leftTps !== undefined && rightTps !== undefined && leftTps !== rightTps) {
        return rightTps - leftTps;
    }

    return left.label.localeCompare(right.label);
}

function sortProviderModels(providerId: RuntimeProviderId, models: ProviderModelRecord[]): ProviderModelRecord[] {
    if (providerId !== 'kilo') {
        return models.slice().sort((left, right) => left.label.localeCompare(right.label));
    }

    return models.slice().sort(compareByKiloRanking);
}

function mapDiscovery(row: {
    profile_id: string;
    provider_id: string;
    kind: string;
    status: string;
    etag: string | null;
    payload_json: string;
    fetched_at: string;
}): ProviderDiscoverySnapshotRecord {
    return {
        profileId: row.profile_id,
        providerId: row.provider_id as RuntimeProviderId,
        kind: row.kind === 'providers' ? 'providers' : 'models',
        status: row.status === 'error' ? 'error' : 'ok',
        ...(row.etag ? { etag: row.etag } : {}),
        payload: parseJsonValue(row.payload_json, {}),
        fetchedAt: row.fetched_at,
    };
}

function normalizeComparableModel(model: ProviderCatalogModelUpsert): ComparableCatalogModel {
    return {
        modelId: model.modelId,
        label: model.label,
        upstreamProvider: model.upstreamProvider ?? null,
        isFree: model.isFree ?? false,
        supportsTools: model.supportsTools ?? false,
        supportsReasoning: model.supportsReasoning ?? false,
        supportsVision: model.supportsVision ?? false,
        supportsAudioInput: model.supportsAudioInput ?? false,
        supportsAudioOutput: model.supportsAudioOutput ?? false,
        inputModalities: normalizeModalities(model.inputModalities),
        outputModalities: normalizeModalities(model.outputModalities),
        promptFamily: model.promptFamily ?? null,
        contextLength: model.contextLength ?? null,
        pricing: model.pricing ?? {},
        raw: model.raw ?? {},
        source: model.source,
    };
}

function normalizeRecordKeys(value: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));
}

function serializeComparableModels(models: ComparableCatalogModel[]): string {
    return JSON.stringify(
        models
            .slice()
            .sort((left, right) => left.modelId.localeCompare(right.modelId))
            .map((model) => ({
                ...model,
                pricing: normalizeRecordKeys(model.pricing),
                raw: normalizeRecordKeys(model.raw),
            }))
    );
}

export class ProviderCatalogStore {
    async listModels(profileId: string, providerId: RuntimeProviderId): Promise<ProviderModelRecord[]> {
        const { db } = getPersistence();

        const rows = await db
            .selectFrom('provider_model_catalog')
            .select([
                'model_id',
                'provider_id',
                'label',
                'upstream_provider',
                'supports_tools',
                'supports_reasoning',
                'supports_vision',
                'supports_audio_input',
                'supports_audio_output',
                'pricing_json',
                'raw_json',
                'input_modalities_json',
                'output_modalities_json',
                'prompt_family',
            ])
            .where('profile_id', '=', profileId)
            .where('provider_id', '=', providerId)
            .execute();

        return sortProviderModels(providerId, rows.map(mapModel));
    }

    async listByProfile(profileId: string): Promise<ProviderModelRecord[]> {
        const { db } = getPersistence();

        const rows = await db
            .selectFrom('provider_model_catalog')
            .select([
                'model_id',
                'provider_id',
                'label',
                'upstream_provider',
                'supports_tools',
                'supports_reasoning',
                'supports_vision',
                'supports_audio_input',
                'supports_audio_output',
                'pricing_json',
                'raw_json',
                'input_modalities_json',
                'output_modalities_json',
                'prompt_family',
            ])
            .where('profile_id', '=', profileId)
            .execute();

        const byProvider = new Map<RuntimeProviderId, ProviderModelRecord[]>();
        for (const row of rows) {
            const mapped = mapModel(row);
            const existing = byProvider.get(mapped.providerId) ?? [];
            existing.push(mapped);
            byProvider.set(mapped.providerId, existing);
        }

        const sortedProviderIds = Array.from(byProvider.keys()).sort((left, right) => left.localeCompare(right));
        const ordered: ProviderModelRecord[] = [];
        for (const providerId of sortedProviderIds) {
            const providerModels = byProvider.get(providerId) ?? [];
            ordered.push(...sortProviderModels(providerId, providerModels));
        }

        return ordered;
    }

    async modelExists(profileId: string, providerId: RuntimeProviderId, modelId: string): Promise<boolean> {
        const { db } = getPersistence();
        const row = await db
            .selectFrom('provider_model_catalog')
            .select('model_id')
            .where('profile_id', '=', profileId)
            .where('provider_id', '=', providerId)
            .where('model_id', '=', modelId)
            .executeTakeFirst();

        return Boolean(row);
    }

    async getModelCapabilities(
        profileId: string,
        providerId: RuntimeProviderId,
        modelId: string
    ): Promise<ProviderModelCapabilities | null> {
        const { db } = getPersistence();
        const row = await db
            .selectFrom('provider_model_catalog')
            .select([
                'supports_tools',
                'supports_reasoning',
                'supports_vision',
                'supports_audio_input',
                'supports_audio_output',
                'input_modalities_json',
                'output_modalities_json',
                'prompt_family',
            ])
            .where('profile_id', '=', profileId)
            .where('provider_id', '=', providerId)
            .where('model_id', '=', modelId)
            .executeTakeFirst();

        if (!row) {
            return null;
        }

        const inputModalities = parseModalities(row.input_modalities_json);
        const outputModalities = parseModalities(row.output_modalities_json);

        return {
            supportsTools: row.supports_tools === 1,
            supportsReasoning: row.supports_reasoning === 1,
            supportsVision:
                row.supports_vision === null ? inputModalities.includes('image') : row.supports_vision === 1,
            supportsAudioInput:
                row.supports_audio_input === null ? inputModalities.includes('audio') : row.supports_audio_input === 1,
            supportsAudioOutput:
                row.supports_audio_output === null
                    ? outputModalities.includes('audio')
                    : row.supports_audio_output === 1,
            inputModalities,
            outputModalities,
            ...(row.prompt_family ? { promptFamily: row.prompt_family } : {}),
        };
    }

    async replaceModels(
        profileId: string,
        providerId: RuntimeProviderId,
        models: ProviderCatalogModelUpsert[]
    ): Promise<ReplaceCatalogModelsResult> {
        const { db } = getPersistence();
        const updatedAt = nowIso();
        const normalizedModels = models.map(normalizeComparableModel);

        const existingRows = await db
            .selectFrom('provider_model_catalog')
            .select([
                'model_id',
                'label',
                'upstream_provider',
                'is_free',
                'supports_tools',
                'supports_reasoning',
                'supports_vision',
                'supports_audio_input',
                'supports_audio_output',
                'input_modalities_json',
                'output_modalities_json',
                'prompt_family',
                'context_length',
                'pricing_json',
                'raw_json',
                'source',
            ])
            .where('profile_id', '=', profileId)
            .where('provider_id', '=', providerId)
            .execute();

        const existingSerialized = serializeComparableModels(
            existingRows.map((row) => ({
                modelId: row.model_id,
                label: row.label,
                upstreamProvider: row.upstream_provider,
                isFree: row.is_free === 1,
                supportsTools: row.supports_tools === 1,
                supportsReasoning: row.supports_reasoning === 1,
                supportsVision: row.supports_vision === null ? false : row.supports_vision === 1,
                supportsAudioInput: row.supports_audio_input === null ? false : row.supports_audio_input === 1,
                supportsAudioOutput: row.supports_audio_output === null ? false : row.supports_audio_output === 1,
                inputModalities: parseModalities(row.input_modalities_json),
                outputModalities: parseModalities(row.output_modalities_json),
                promptFamily: row.prompt_family,
                contextLength: row.context_length,
                pricing: parseJsonValue(row.pricing_json, {}),
                raw: parseJsonValue(row.raw_json, {}),
                source: row.source,
            }))
        );
        const nextSerialized = serializeComparableModels(normalizedModels);

        if (existingSerialized === nextSerialized) {
            return {
                modelCount: normalizedModels.length,
                changed: false,
            };
        }

        await db
            .deleteFrom('provider_model_catalog')
            .where('profile_id', '=', profileId)
            .where('provider_id', '=', providerId)
            .execute();

        if (normalizedModels.length === 0) {
            return {
                modelCount: 0,
                changed: true,
            };
        }

        await db
            .insertInto('provider_model_catalog')
            .values(
                normalizedModels.map((model) => ({
                    profile_id: profileId,
                    provider_id: providerId,
                    model_id: model.modelId,
                    label: model.label,
                    upstream_provider: model.upstreamProvider,
                    is_free: model.isFree ? 1 : 0,
                    supports_tools: model.supportsTools ? 1 : 0,
                    supports_reasoning: model.supportsReasoning ? 1 : 0,
                    supports_vision: model.supportsVision ? 1 : 0,
                    supports_audio_input: model.supportsAudioInput ? 1 : 0,
                    supports_audio_output: model.supportsAudioOutput ? 1 : 0,
                    input_modalities_json: JSON.stringify(model.inputModalities),
                    output_modalities_json: JSON.stringify(model.outputModalities),
                    prompt_family: model.promptFamily,
                    context_length: model.contextLength,
                    pricing_json: JSON.stringify(model.pricing),
                    raw_json: JSON.stringify(model.raw),
                    source: model.source,
                    updated_at: updatedAt,
                }))
            )
            .execute();

        return {
            modelCount: normalizedModels.length,
            changed: true,
        };
    }

    async upsertDiscoverySnapshot(input: {
        profileId: string;
        providerId: RuntimeProviderId;
        kind: 'models' | 'providers';
        payload: Record<string, unknown>;
        status: 'ok' | 'error';
        etag?: string;
    }): Promise<void> {
        const { db } = getPersistence();
        const fetchedAt = nowIso();

        await db
            .insertInto('provider_discovery_snapshots')
            .values({
                profile_id: input.profileId,
                provider_id: input.providerId,
                kind: input.kind,
                etag: input.etag ?? null,
                payload_json: JSON.stringify(input.payload),
                fetched_at: fetchedAt,
                status: input.status,
            })
            .onConflict((oc) =>
                oc.columns(['profile_id', 'provider_id', 'kind']).doUpdateSet({
                    etag: input.etag ?? null,
                    payload_json: JSON.stringify(input.payload),
                    fetched_at: fetchedAt,
                    status: input.status,
                })
            )
            .execute();
    }

    async listDiscoverySnapshotsByProfile(profileId: string): Promise<ProviderDiscoverySnapshotRecord[]> {
        const { db } = getPersistence();
        const rows = await db
            .selectFrom('provider_discovery_snapshots')
            .select(['profile_id', 'provider_id', 'kind', 'status', 'etag', 'payload_json', 'fetched_at'])
            .where('profile_id', '=', profileId)
            .orderBy('provider_id', 'asc')
            .orderBy('kind', 'asc')
            .execute();

        return rows.map(mapDiscovery);
    }
}

export const providerCatalogStore = new ProviderCatalogStore();
