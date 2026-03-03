import { getPersistence } from '@/app/backend/persistence/db';
import { nowIso } from '@/app/backend/persistence/stores/utils';
import type { RunRecord } from '@/app/backend/persistence/types';
import { assertSupportedProviderId } from '@/app/backend/providers/registry';
import { providerAuthMethods, runStatuses } from '@/app/backend/runtime/contracts';
import { createEntityId } from '@/app/backend/runtime/contracts';
import type { EntityId, ProviderAuthMethod, RunStatus, RuntimeProviderId } from '@/app/backend/runtime/contracts';

function isOneOf<T extends string>(value: string, allowed: readonly T[]): value is T {
    return allowed.some((candidate) => candidate === value);
}

function parseRunStatus(value: string): RunStatus {
    if (isOneOf(value, runStatuses)) {
        return value;
    }

    throw new Error(`Invalid run status in persistence row: "${value}".`);
}

function parseAuthMethod(value: string | null): ProviderAuthMethod | 'none' | undefined {
    if (!value) {
        return undefined;
    }

    if (value === 'none') {
        return 'none';
    }

    if (isOneOf(value, providerAuthMethods)) {
        return value;
    }

    throw new Error(`Invalid run auth method in persistence row: "${value}".`);
}

function parseProviderId(value: string | null): RuntimeProviderId | undefined {
    if (!value) {
        return undefined;
    }

    return assertSupportedProviderId(value);
}

function mapRunRecord(row: {
    id: string;
    session_id: string;
    profile_id: string;
    prompt: string;
    status: string;
    provider_id: string | null;
    model_id: string | null;
    auth_method: string | null;
    started_at: string | null;
    completed_at: string | null;
    aborted_at: string | null;
    error_code: string | null;
    error_message: string | null;
    created_at: string;
    updated_at: string;
}): RunRecord {
    const providerId = parseProviderId(row.provider_id);
    const authMethod = parseAuthMethod(row.auth_method);

    return {
        id: row.id as EntityId<'run'>,
        sessionId: row.session_id as EntityId<'sess'>,
        profileId: row.profile_id,
        prompt: row.prompt,
        status: parseRunStatus(row.status),
        ...(providerId ? { providerId } : {}),
        ...(row.model_id ? { modelId: row.model_id } : {}),
        ...(authMethod ? { authMethod } : {}),
        ...(row.started_at ? { startedAt: row.started_at } : {}),
        ...(row.completed_at ? { completedAt: row.completed_at } : {}),
        ...(row.aborted_at ? { abortedAt: row.aborted_at } : {}),
        ...(row.error_code ? { errorCode: row.error_code } : {}),
        ...(row.error_message ? { errorMessage: row.error_message } : {}),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export interface CreateRunInput {
    profileId: string;
    sessionId: string;
    prompt: string;
    providerId: RuntimeProviderId;
    modelId: string;
    authMethod: ProviderAuthMethod | 'none';
}

export interface FinalizeRunInput {
    status: Extract<RunStatus, 'completed' | 'aborted' | 'error'>;
    errorCode?: string;
    errorMessage?: string;
}

export class RunStore {
    async create(input: CreateRunInput): Promise<RunRecord> {
        const { db } = getPersistence();
        const runId = createEntityId('run');
        const now = nowIso();

        await db
            .insertInto('runs')
            .values({
                id: runId,
                session_id: input.sessionId,
                profile_id: input.profileId,
                prompt: input.prompt,
                status: 'running',
                provider_id: input.providerId,
                model_id: input.modelId,
                auth_method: input.authMethod,
                started_at: now,
                completed_at: null,
                aborted_at: null,
                error_code: null,
                error_message: null,
                created_at: now,
                updated_at: now,
            })
            .execute();

        const row = await db.selectFrom('runs').selectAll().where('id', '=', runId).executeTakeFirstOrThrow();

        return mapRunRecord(row);
    }

    async getById(runId: string): Promise<RunRecord | null> {
        const { db } = getPersistence();

        const row = await db.selectFrom('runs').selectAll().where('id', '=', runId).executeTakeFirst();

        return row ? mapRunRecord(row) : null;
    }

    async listBySession(profileId: string, sessionId: string): Promise<RunRecord[]> {
        const { db } = getPersistence();
        const rows = await db
            .selectFrom('runs')
            .selectAll()
            .where('profile_id', '=', profileId)
            .where('session_id', '=', sessionId)
            .orderBy('created_at', 'asc')
            .execute();

        return rows.map(mapRunRecord);
    }

    async listByProfile(profileId: string): Promise<RunRecord[]> {
        const { db } = getPersistence();
        const rows = await db
            .selectFrom('runs')
            .selectAll()
            .where('profile_id', '=', profileId)
            .orderBy('created_at', 'asc')
            .execute();

        return rows.map(mapRunRecord);
    }

    async finalize(runId: string, input: FinalizeRunInput): Promise<RunRecord | null> {
        const { db } = getPersistence();
        const now = nowIso();
        const values = {
            status: input.status,
            updated_at: now,
            completed_at: input.status === 'completed' ? now : null,
            aborted_at: input.status === 'aborted' ? now : null,
            error_code: input.errorCode ?? null,
            error_message: input.errorMessage ?? null,
        };

        const row = await db.updateTable('runs').set(values).where('id', '=', runId).returningAll().executeTakeFirst();

        return row ? mapRunRecord(row) : null;
    }

    async deleteById(runId: string): Promise<boolean> {
        const { db } = getPersistence();
        const row = await db.deleteFrom('runs').where('id', '=', runId).returning('id').executeTakeFirst();
        return Boolean(row);
    }
}

export const runStore = new RunStore();
