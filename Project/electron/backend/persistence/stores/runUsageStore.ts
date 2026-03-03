import { sql } from 'kysely';

import { getPersistence } from '@/app/backend/persistence/db';
import { nowIso } from '@/app/backend/persistence/stores/utils';
import type { ProviderUsageSummary, RunUsageRecord } from '@/app/backend/persistence/types';
import { assertSupportedProviderId } from '@/app/backend/providers/registry';
import type { EntityId, RuntimeProviderId } from '@/app/backend/runtime/contracts';

function readNumber(value: number | null): number | undefined {
    return value === null ? undefined : value;
}

const billedViaValues = ['kilo_gateway', 'openai_api', 'openai_subscription'] as const;
type BilledVia = (typeof billedViaValues)[number];

function parseBilledVia(value: string): BilledVia {
    if (billedViaValues.some((candidate) => candidate === value)) {
        return value as BilledVia;
    }

    throw new Error(`Invalid billed_via in run_usage row: "${value}".`);
}

function mapRunUsageRecord(row: {
    run_id: string;
    provider_id: string;
    model_id: string;
    input_tokens: number | null;
    output_tokens: number | null;
    cached_tokens: number | null;
    reasoning_tokens: number | null;
    total_tokens: number | null;
    latency_ms: number | null;
    cost_microunits: number | null;
    billed_via: string;
    recorded_at: string;
}): RunUsageRecord {
    const record: RunUsageRecord = {
        runId: row.run_id as EntityId<'run'>,
        providerId: assertSupportedProviderId(row.provider_id),
        modelId: row.model_id,
        billedVia: parseBilledVia(row.billed_via),
        recordedAt: row.recorded_at,
    };

    const inputTokens = readNumber(row.input_tokens);
    const outputTokens = readNumber(row.output_tokens);
    const cachedTokens = readNumber(row.cached_tokens);
    const reasoningTokens = readNumber(row.reasoning_tokens);
    const totalTokens = readNumber(row.total_tokens);
    const latencyMs = readNumber(row.latency_ms);
    const costMicrounits = readNumber(row.cost_microunits);

    if (inputTokens !== undefined) record.inputTokens = inputTokens;
    if (outputTokens !== undefined) record.outputTokens = outputTokens;
    if (cachedTokens !== undefined) record.cachedTokens = cachedTokens;
    if (reasoningTokens !== undefined) record.reasoningTokens = reasoningTokens;
    if (totalTokens !== undefined) record.totalTokens = totalTokens;
    if (latencyMs !== undefined) record.latencyMs = latencyMs;
    if (costMicrounits !== undefined) record.costMicrounits = costMicrounits;

    return record;
}

export interface UpsertRunUsageInput {
    runId: string;
    providerId: RuntimeProviderId;
    modelId: string;
    inputTokens?: number;
    outputTokens?: number;
    cachedTokens?: number;
    reasoningTokens?: number;
    totalTokens?: number;
    latencyMs?: number;
    costMicrounits?: number;
    billedVia: 'kilo_gateway' | 'openai_api' | 'openai_subscription';
}

export class RunUsageStore {
    async upsert(input: UpsertRunUsageInput): Promise<RunUsageRecord> {
        const { db } = getPersistence();
        const recordedAt = nowIso();

        await db
            .insertInto('run_usage')
            .values({
                run_id: input.runId,
                provider_id: input.providerId,
                model_id: input.modelId,
                input_tokens: input.inputTokens ?? null,
                output_tokens: input.outputTokens ?? null,
                cached_tokens: input.cachedTokens ?? null,
                reasoning_tokens: input.reasoningTokens ?? null,
                total_tokens: input.totalTokens ?? null,
                latency_ms: input.latencyMs ?? null,
                cost_microunits: input.costMicrounits ?? null,
                billed_via: input.billedVia,
                recorded_at: recordedAt,
            })
            .onConflict((oc) =>
                oc.column('run_id').doUpdateSet({
                    provider_id: input.providerId,
                    model_id: input.modelId,
                    input_tokens: input.inputTokens ?? null,
                    output_tokens: input.outputTokens ?? null,
                    cached_tokens: input.cachedTokens ?? null,
                    reasoning_tokens: input.reasoningTokens ?? null,
                    total_tokens: input.totalTokens ?? null,
                    latency_ms: input.latencyMs ?? null,
                    cost_microunits: input.costMicrounits ?? null,
                    billed_via: input.billedVia,
                    recorded_at: recordedAt,
                })
            )
            .execute();

        const row = await db
            .selectFrom('run_usage')
            .selectAll()
            .where('run_id', '=', input.runId)
            .executeTakeFirstOrThrow();

        return mapRunUsageRecord(row);
    }

    async listByProfile(profileId: string): Promise<RunUsageRecord[]> {
        const { db } = getPersistence();
        const rows = await db
            .selectFrom('run_usage')
            .innerJoin('runs', 'runs.id', 'run_usage.run_id')
            .select([
                'run_usage.run_id as run_id',
                'run_usage.provider_id as provider_id',
                'run_usage.model_id as model_id',
                'run_usage.input_tokens as input_tokens',
                'run_usage.output_tokens as output_tokens',
                'run_usage.cached_tokens as cached_tokens',
                'run_usage.reasoning_tokens as reasoning_tokens',
                'run_usage.total_tokens as total_tokens',
                'run_usage.latency_ms as latency_ms',
                'run_usage.cost_microunits as cost_microunits',
                'run_usage.billed_via as billed_via',
                'run_usage.recorded_at as recorded_at',
            ])
            .where('runs.profile_id', '=', profileId)
            .orderBy('run_usage.recorded_at', 'asc')
            .execute();

        return rows.map(mapRunUsageRecord);
    }

    async summarizeByProfile(profileId: string): Promise<ProviderUsageSummary[]> {
        const { db } = getPersistence();
        const rows = await db
            .selectFrom('run_usage')
            .innerJoin('runs', 'runs.id', 'run_usage.run_id')
            .select((eb) => [
                'run_usage.provider_id as provider_id',
                eb.fn.count<number>('run_usage.run_id').as('run_count'),
                eb.fn.coalesce(eb.fn.sum<number>('run_usage.total_tokens'), sql<number>`0`).as('total_tokens'),
                eb.fn
                    .coalesce(eb.fn.sum<number>('run_usage.cost_microunits'), sql<number>`0`)
                    .as('total_cost_microunits'),
            ])
            .where('runs.profile_id', '=', profileId)
            .groupBy('run_usage.provider_id')
            .orderBy('run_usage.provider_id', 'asc')
            .execute();

        return rows.map((row) => ({
            providerId: assertSupportedProviderId(row.provider_id),
            runCount: row.run_count,
            totalTokens: row.total_tokens,
            totalCostMicrounits: row.total_cost_microunits,
        }));
    }
}

export const runUsageStore = new RunUsageStore();
