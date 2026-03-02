import {
    createEntityId,
    sessionByIdInputSchema,
    sessionCreateInputSchema,
    sessionPromptInputSchema,
} from '@/app/backend/runtime/contracts';
import { createSessionRecord, getRuntimeState } from '@/app/backend/runtime/state';
import { publicProcedure, router } from '@/app/backend/trpc/init';

import type { SessionRecord } from '@/app/backend/runtime/state';
import type { EntityId } from '@/app/backend/runtime/contracts';

function toSessionSummary(session: SessionRecord): {
    id: EntityId<'sess'>;
    scope: SessionRecord['scope'];
    kind: SessionRecord['kind'];
    runStatus: SessionRecord['runStatus'];
    turnCount: number;
    createdAt: string;
    updatedAt: string;
} {
    return {
        id: session.id,
        scope: session.scope,
        kind: session.kind,
        runStatus: session.runStatus,
        turnCount: session.turns.length,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
    };
}

function finalizePendingRunIfNeeded(session: SessionRecord): void {
    const pendingRunId = session.pendingCompletionRunId;
    if (session.runStatus !== 'running' || !pendingRunId) {
        return;
    }

    const pendingTurn = session.turns.find((turn) => turn.runId === pendingRunId);
    if (!pendingTurn) {
        session.runStatus = 'error';
        session.pendingCompletionRunId = null;
        session.updatedAt = new Date().toISOString();
        return;
    }

    const now = new Date().toISOString();
    pendingTurn.status = 'completed';
    pendingTurn.updatedAt = now;
    session.runStatus = 'completed';
    session.pendingCompletionRunId = null;
    session.updatedAt = now;
}

export const sessionRouter = router({
    create: publicProcedure.input(sessionCreateInputSchema).mutation(({ input }) => {
        const state = getRuntimeState();
        const session = createSessionRecord(input.scope, input.kind);

        state.sessions.set(session.id, session);

        return { session: toSessionSummary(session) };
    }),
    list: publicProcedure.query(() => {
        const state = getRuntimeState();
        const sessions = [...state.sessions.values()]
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .map(toSessionSummary);

        return { sessions };
    }),
    status: publicProcedure.input(sessionByIdInputSchema).query(({ input }) => {
        const state = getRuntimeState();
        const session = state.sessions.get(input.sessionId);
        if (!session) {
            return { found: false as const };
        }

        finalizePendingRunIfNeeded(session);

        return {
            found: true as const,
            session: toSessionSummary(session),
            activeRunId: session.pendingCompletionRunId,
        };
    }),
    prompt: publicProcedure.input(sessionPromptInputSchema).mutation(({ input }) => {
        const state = getRuntimeState();
        const session = state.sessions.get(input.sessionId);
        if (!session) {
            return { accepted: false as const, reason: 'not_found' as const };
        }
        if (session.runStatus === 'running') {
            return { accepted: false as const, reason: 'already_running' as const };
        }

        const runId = createEntityId('run');
        const now = new Date().toISOString();

        session.turns.push({
            runId,
            prompt: input.prompt,
            status: 'running',
            createdAt: now,
            updatedAt: now,
        });
        session.runStatus = 'running';
        session.pendingCompletionRunId = runId;
        session.updatedAt = now;

        return {
            accepted: true as const,
            runId,
            runStatus: session.runStatus,
            turnCount: session.turns.length,
        };
    }),
    abort: publicProcedure.input(sessionByIdInputSchema).mutation(({ input }) => {
        const state = getRuntimeState();
        const session = state.sessions.get(input.sessionId);
        if (!session) {
            return { aborted: false as const, reason: 'not_found' as const };
        }
        if (session.runStatus !== 'running') {
            return { aborted: false as const, reason: 'not_running' as const };
        }

        const now = new Date().toISOString();
        const pendingRunId = session.pendingCompletionRunId;
        if (pendingRunId) {
            const pendingTurn = session.turns.find((turn) => turn.runId === pendingRunId);
            if (pendingTurn) {
                pendingTurn.status = 'aborted';
                pendingTurn.updatedAt = now;
            }
        }

        session.runStatus = 'aborted';
        session.pendingCompletionRunId = null;
        session.updatedAt = now;

        return {
            aborted: true as const,
            session: toSessionSummary(session),
        };
    }),
    revert: publicProcedure.input(sessionByIdInputSchema).mutation(({ input }) => {
        const state = getRuntimeState();
        const session = state.sessions.get(input.sessionId);
        if (!session) {
            return { reverted: false as const, reason: 'not_found' as const };
        }
        if (session.turns.length === 0) {
            return { reverted: false as const, reason: 'no_turns' as const };
        }

        const removedTurn = session.turns.pop();
        const nextTurn = session.turns.at(-1);
        const now = new Date().toISOString();

        if (removedTurn && session.pendingCompletionRunId === removedTurn.runId) {
            session.pendingCompletionRunId = null;
        }

        session.runStatus = nextTurn?.status ?? 'idle';
        session.updatedAt = now;

        return {
            reverted: true as const,
            session: toSessionSummary(session),
        };
    }),
});
