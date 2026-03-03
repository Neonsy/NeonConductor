import { getPersistence } from '@/app/backend/persistence/db';
import type { RunsTable, SessionsTable } from '@/app/backend/persistence/schema';
import { threadStore } from '@/app/backend/persistence/stores/threadStore';
import { nowIso } from '@/app/backend/persistence/stores/utils';
import type { SessionSummaryRecord } from '@/app/backend/persistence/types';
import { createEntityId, runStatuses } from '@/app/backend/runtime/contracts';
import type { EntityId, RunStatus, SessionKind } from '@/app/backend/runtime/contracts';

import type { Selectable } from 'kysely';

type SessionRow = Selectable<SessionsTable>;
type RunRow = Selectable<RunsTable>;

function isOneOf<T extends string>(value: string, allowed: readonly T[]): value is T {
    return allowed.some((candidate) => candidate === value);
}

function parseRunStatus(value: string): RunStatus {
    if (isOneOf(value, runStatuses)) {
        return value;
    }

    throw new Error(`Invalid session run status in persistence row: "${value}".`);
}

function mapSessionSummary(row: SessionRow, turnCount: number): SessionSummaryRecord {
    return {
        id: row.id as EntityId<'sess'>,
        profileId: row.profile_id,
        conversationId: row.conversation_id,
        threadId: row.thread_id,
        kind: row.kind as SessionKind,
        runStatus: parseRunStatus(row.run_status),
        turnCount,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function mapRunStatusToSessionStatus(runStatus: string | null): RunStatus {
    if (runStatus === 'running') return 'running';
    if (runStatus === 'completed') return 'completed';
    if (runStatus === 'aborted') return 'aborted';
    if (runStatus === 'error') return 'error';
    return 'idle';
}

export class SessionStore {
    private async countTurns(profileId: string, sessionId: string): Promise<number> {
        const { db } = getPersistence();

        const result = await db
            .selectFrom('runs')
            .select((eb) => eb.fn.count<number>('id').as('count'))
            .where('profile_id', '=', profileId)
            .where('session_id', '=', sessionId)
            .executeTakeFirst();

        return result?.count ?? 0;
    }

    private async getSessionById(profileId: string, sessionId: string): Promise<SessionRow | null> {
        const { db } = getPersistence();

        const row = await db
            .selectFrom('sessions')
            .selectAll()
            .where('id', '=', sessionId)
            .where('profile_id', '=', profileId)
            .executeTakeFirst();

        return row ?? null;
    }

    private async getLatestRun(profileId: string, sessionId: string): Promise<RunRow | null> {
        const { db } = getPersistence();

        const row = await db
            .selectFrom('runs')
            .selectAll()
            .where('profile_id', '=', profileId)
            .where('session_id', '=', sessionId)
            .orderBy('created_at', 'desc')
            .orderBy('id', 'desc')
            .executeTakeFirst();

        return row ?? null;
    }

    async create(profileId: string, threadId: string, kind: SessionKind): Promise<SessionSummaryRecord> {
        const { db } = getPersistence();
        const now = nowIso();
        const thread = await db
            .selectFrom('threads')
            .select(['id', 'conversation_id'])
            .where('id', '=', threadId)
            .where('profile_id', '=', profileId)
            .executeTakeFirst();
        if (!thread) {
            throw new Error(`Thread "${threadId}" does not exist for profile "${profileId}".`);
        }

        const inserted = await db
            .insertInto('sessions')
            .values({
                id: createEntityId('sess'),
                profile_id: profileId,
                conversation_id: thread.conversation_id,
                thread_id: thread.id,
                kind,
                run_status: 'idle',
                pending_completion_run_id: null,
                created_at: now,
                updated_at: now,
            })
            .returningAll()
            .executeTakeFirstOrThrow();

        await threadStore.touchByThread(profileId, thread.id);
        return mapSessionSummary(inserted, 0);
    }

    async list(profileId: string): Promise<SessionSummaryRecord[]> {
        const { db } = getPersistence();

        const rows = await db
            .selectFrom('sessions')
            .selectAll()
            .where('profile_id', '=', profileId)
            .orderBy('updated_at', 'desc')
            .execute();

        const summaries: SessionSummaryRecord[] = [];
        for (const row of rows) {
            summaries.push(mapSessionSummary(row, await this.countTurns(profileId, row.id)));
        }

        return summaries;
    }

    async status(
        profileId: string,
        sessionId: EntityId<'sess'>
    ): Promise<
        | { found: false }
        | {
              found: true;
              session: SessionSummaryRecord;
              activeRunId: EntityId<'run'> | null;
          }
    > {
        const session = await this.getSessionById(profileId, sessionId);
        if (!session) {
            return { found: false };
        }

        const turnCount = await this.countTurns(profileId, session.id);

        return {
            found: true,
            session: mapSessionSummary(session, turnCount),
            activeRunId: session.pending_completion_run_id as EntityId<'run'> | null,
        };
    }

    async markRunPending(profileId: string, sessionId: string, runId: string): Promise<void> {
        const { db } = getPersistence();
        const updated = await db
            .updateTable('sessions')
            .set({
                run_status: 'running',
                pending_completion_run_id: runId,
                updated_at: nowIso(),
            })
            .where('id', '=', sessionId)
            .where('profile_id', '=', profileId)
            .returning(['thread_id'])
            .execute();

        const threadId = updated.at(0)?.thread_id;
        if (threadId) {
            await threadStore.touchByThread(profileId, threadId);
        }
    }

    async markRunTerminal(
        profileId: string,
        sessionId: string,
        status: Extract<RunStatus, 'completed' | 'aborted' | 'error'>
    ): Promise<void> {
        const { db } = getPersistence();
        const updated = await db
            .updateTable('sessions')
            .set({
                run_status: status,
                pending_completion_run_id: null,
                updated_at: nowIso(),
            })
            .where('id', '=', sessionId)
            .where('profile_id', '=', profileId)
            .returning(['thread_id'])
            .execute();

        const threadId = updated.at(0)?.thread_id;
        if (threadId) {
            await threadStore.touchByThread(profileId, threadId);
        }
    }

    async clearPendingRun(profileId: string, sessionId: string): Promise<void> {
        const { db } = getPersistence();
        const updated = await db
            .updateTable('sessions')
            .set({
                pending_completion_run_id: null,
                updated_at: nowIso(),
            })
            .where('id', '=', sessionId)
            .where('profile_id', '=', profileId)
            .returning(['thread_id'])
            .execute();

        const threadId = updated.at(0)?.thread_id;
        if (threadId) {
            await threadStore.touchByThread(profileId, threadId);
        }
    }

    async revert(
        profileId: string,
        sessionId: EntityId<'sess'>
    ): Promise<
        { reverted: false; reason: 'not_found' | 'no_turns' } | { reverted: true; session: SessionSummaryRecord }
    > {
        const { db } = getPersistence();
        const session = await this.getSessionById(profileId, sessionId);
        if (!session) {
            return { reverted: false, reason: 'not_found' };
        }

        const latestRun = await this.getLatestRun(profileId, session.id);
        if (!latestRun) {
            return { reverted: false, reason: 'no_turns' };
        }

        await db.deleteFrom('runs').where('id', '=', latestRun.id).where('profile_id', '=', profileId).execute();

        const now = nowIso();
        const nextRun = await this.getLatestRun(profileId, session.id);
        const nextStatus = mapRunStatusToSessionStatus(nextRun?.status ?? null);
        const nextPendingRunId = nextRun?.status === 'running' ? nextRun.id : null;

        const updatedSession = await db
            .updateTable('sessions')
            .set({
                run_status: nextStatus,
                pending_completion_run_id: nextPendingRunId,
                updated_at: now,
            })
            .where('id', '=', session.id)
            .where('profile_id', '=', profileId)
            .returningAll()
            .executeTakeFirstOrThrow();

        return {
            reverted: true,
            session: mapSessionSummary(updatedSession, await this.countTurns(profileId, updatedSession.id)),
        };
    }

    async ensureRunnableSession(
        profileId: string,
        sessionId: EntityId<'sess'>
    ): Promise<{ ok: false; reason: 'not_found' | 'already_running' } | { ok: true; session: SessionRow }> {
        const session = await this.getSessionById(profileId, sessionId);
        if (!session) {
            return { ok: false, reason: 'not_found' };
        }

        if (session.run_status === 'running') {
            return { ok: false, reason: 'already_running' };
        }

        return { ok: true, session };
    }
}

export const sessionStore = new SessionStore();
