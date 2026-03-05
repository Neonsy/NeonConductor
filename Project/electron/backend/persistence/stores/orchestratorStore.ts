import { getPersistence } from '@/app/backend/persistence/db';
import { parseEntityId, parseEnumValue } from '@/app/backend/persistence/stores/rowParsers';
import { nowIso } from '@/app/backend/persistence/stores/utils';
import type { OrchestratorRunRecord, OrchestratorStepRecord } from '@/app/backend/persistence/types';
import { createEntityId, orchestratorRunStatuses, planItemStatuses } from '@/app/backend/runtime/contracts';
import type { EntityId, OrchestratorRunStatus } from '@/app/backend/runtime/contracts';

function mapOrchestratorRunRecord(row: {
    id: string;
    profile_id: string;
    session_id: string;
    plan_id: string;
    status: string;
    active_step_index: number | null;
    started_at: string;
    completed_at: string | null;
    aborted_at: string | null;
    error_message: string | null;
    created_at: string;
    updated_at: string;
}): OrchestratorRunRecord {
    return {
        id: parseEntityId(row.id, 'orchestrator_runs.id', 'orch'),
        profileId: row.profile_id,
        sessionId: parseEntityId(row.session_id, 'orchestrator_runs.session_id', 'sess'),
        planId: parseEntityId(row.plan_id, 'orchestrator_runs.plan_id', 'plan'),
        status: parseEnumValue(row.status, 'orchestrator_runs.status', orchestratorRunStatuses),
        ...(row.active_step_index !== null ? { activeStepIndex: row.active_step_index } : {}),
        startedAt: row.started_at,
        ...(row.completed_at ? { completedAt: row.completed_at } : {}),
        ...(row.aborted_at ? { abortedAt: row.aborted_at } : {}),
        ...(row.error_message ? { errorMessage: row.error_message } : {}),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function mapOrchestratorStepRecord(row: {
    id: string;
    orchestrator_run_id: string;
    sequence: number;
    description: string;
    status: string;
    run_id: string | null;
    error_message: string | null;
    created_at: string;
    updated_at: string;
}): OrchestratorStepRecord {
    return {
        id: parseEntityId(row.id, 'orchestrator_steps.id', 'step'),
        orchestratorRunId: parseEntityId(row.orchestrator_run_id, 'orchestrator_steps.orchestrator_run_id', 'orch'),
        sequence: row.sequence,
        description: row.description,
        status: parseEnumValue(row.status, 'orchestrator_steps.status', planItemStatuses),
        ...(row.run_id ? { runId: parseEntityId(row.run_id, 'orchestrator_steps.run_id', 'run') } : {}),
        ...(row.error_message ? { errorMessage: row.error_message } : {}),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export class OrchestratorStore {
    async createRun(input: {
        profileId: string;
        sessionId: EntityId<'sess'>;
        planId: EntityId<'plan'>;
        stepDescriptions: string[];
    }): Promise<{ run: OrchestratorRunRecord; steps: OrchestratorStepRecord[] }> {
        const { db } = getPersistence();
        const now = nowIso();
        const id = createEntityId('orch');

        await db
            .insertInto('orchestrator_runs')
            .values({
                id,
                profile_id: input.profileId,
                session_id: input.sessionId,
                plan_id: input.planId,
                status: 'running',
                active_step_index: null,
                started_at: now,
                completed_at: null,
                aborted_at: null,
                error_message: null,
                created_at: now,
                updated_at: now,
            })
            .execute();

        if (input.stepDescriptions.length > 0) {
            await db
                .insertInto('orchestrator_steps')
                .values(
                    input.stepDescriptions.map((description, index) => ({
                        id: createEntityId('step'),
                        orchestrator_run_id: id,
                        sequence: index + 1,
                        description,
                        status: 'pending',
                        run_id: null,
                        error_message: null,
                        created_at: now,
                        updated_at: now,
                    }))
                )
                .execute();
        }

        const run = await this.getRunById(input.profileId, id);
        if (!run) {
            throw new Error(`Failed to create orchestrator run "${id}".`);
        }
        const steps = await this.listSteps(id);

        return { run, steps };
    }

    async getRunById(profileId: string, orchestratorRunId: EntityId<'orch'>): Promise<OrchestratorRunRecord | null> {
        const { db } = getPersistence();
        const row = await db
            .selectFrom('orchestrator_runs')
            .selectAll()
            .where('profile_id', '=', profileId)
            .where('id', '=', orchestratorRunId)
            .executeTakeFirst();

        return row ? mapOrchestratorRunRecord(row) : null;
    }

    async getLatestBySession(profileId: string, sessionId: EntityId<'sess'>): Promise<OrchestratorRunRecord | null> {
        const { db } = getPersistence();
        const row = await db
            .selectFrom('orchestrator_runs')
            .selectAll()
            .where('profile_id', '=', profileId)
            .where('session_id', '=', sessionId)
            .orderBy('created_at', 'desc')
            .executeTakeFirst();

        return row ? mapOrchestratorRunRecord(row) : null;
    }

    async listSteps(orchestratorRunId: EntityId<'orch'>): Promise<OrchestratorStepRecord[]> {
        const { db } = getPersistence();
        const rows = await db
            .selectFrom('orchestrator_steps')
            .selectAll()
            .where('orchestrator_run_id', '=', orchestratorRunId)
            .orderBy('sequence', 'asc')
            .execute();

        return rows.map(mapOrchestratorStepRecord);
    }

    async setRunStatus(
        orchestratorRunId: EntityId<'orch'>,
        input: {
            status: OrchestratorRunStatus;
            activeStepIndex?: number;
            errorMessage?: string;
        }
    ): Promise<OrchestratorRunRecord | null> {
        const { db } = getPersistence();
        const now = nowIso();
        const updated = await db
            .updateTable('orchestrator_runs')
            .set({
                status: input.status,
                active_step_index: input.activeStepIndex ?? null,
                completed_at: input.status === 'completed' ? now : null,
                aborted_at: input.status === 'aborted' ? now : null,
                error_message: input.errorMessage ?? null,
                updated_at: now,
            })
            .where('id', '=', orchestratorRunId)
            .returningAll()
            .executeTakeFirst();

        return updated ? mapOrchestratorRunRecord(updated) : null;
    }

    async setStepStatus(
        stepId: EntityId<'step'>,
        status: OrchestratorStepRecord['status'],
        runId?: EntityId<'run'>,
        errorMessage?: string
    ): Promise<OrchestratorStepRecord | null> {
        const { db } = getPersistence();
        const now = nowIso();
        const updated = await db
            .updateTable('orchestrator_steps')
            .set({
                status,
                run_id: runId ?? null,
                error_message: errorMessage ?? null,
                updated_at: now,
            })
            .where('id', '=', stepId)
            .returningAll()
            .executeTakeFirst();

        return updated ? mapOrchestratorStepRecord(updated) : null;
    }
}

export const orchestratorStore = new OrchestratorStore();
