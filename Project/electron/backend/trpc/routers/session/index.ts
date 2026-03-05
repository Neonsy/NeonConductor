import { messageStore, runStore, sessionStore } from '@/app/backend/persistence/stores';
import {
    profileInputSchema,
    sessionByIdInputSchema,
    sessionCreateInputSchema,
    sessionListMessagesInputSchema,
    sessionListRunsInputSchema,
    sessionStartRunInputSchema,
} from '@/app/backend/runtime/contracts';
import { runExecutionService } from '@/app/backend/runtime/services/runExecution/service';
import { runtimeEventLogService } from '@/app/backend/runtime/services/runtimeEventLog';
import { publicProcedure, router } from '@/app/backend/trpc/init';

export const sessionRouter = router({
    create: publicProcedure.input(sessionCreateInputSchema).mutation(async ({ input }) => {
        const session = await sessionStore.create(input.profileId, input.threadId, input.kind);
        await runtimeEventLogService.append({
            entityType: 'session',
            entityId: session.id,
            eventType: 'session.created',
            payload: {
                session,
            },
        });

        return { session };
    }),
    list: publicProcedure.input(profileInputSchema).query(async ({ input }) => {
        return { sessions: await sessionStore.list(input.profileId) };
    }),
    status: publicProcedure.input(sessionByIdInputSchema).query(async ({ input }) => {
        return sessionStore.status(input.profileId, input.sessionId);
    }),
    startRun: publicProcedure.input(sessionStartRunInputSchema).mutation(async ({ input }) => {
        const result = await runExecutionService.startRun(input);

        if (result.accepted) {
            await runtimeEventLogService.append({
                entityType: 'session',
                entityId: input.sessionId,
                eventType: 'session.run.started',
                payload: {
                    runId: result.runId,
                    profileId: input.profileId,
                    topLevelTab: input.topLevelTab,
                    modeKey: input.modeKey,
                    workspaceFingerprint: input.workspaceFingerprint ?? null,
                },
            });
        }

        return result;
    }),
    listRuns: publicProcedure.input(sessionListRunsInputSchema).query(async ({ input }) => {
        return {
            runs: await runStore.listBySession(input.profileId, input.sessionId),
        };
    }),
    listMessages: publicProcedure.input(sessionListMessagesInputSchema).query(async ({ input }) => {
        const [messages, messageParts] = await Promise.all([
            messageStore.listMessagesBySession(input.profileId, input.sessionId, input.runId),
            messageStore.listPartsBySession(input.profileId, input.sessionId, input.runId),
        ]);

        return {
            messages,
            messageParts,
        };
    }),
    abort: publicProcedure.input(sessionByIdInputSchema).mutation(async ({ input }) => {
        const result = await runExecutionService.abortRun(input.profileId, input.sessionId);
        if (result.aborted) {
            await runtimeEventLogService.append({
                entityType: 'session',
                entityId: input.sessionId,
                eventType: 'session.aborted',
                payload: {
                    runId: result.runId,
                    profileId: input.profileId,
                },
            });
        }

        return result;
    }),
    revert: publicProcedure.input(sessionByIdInputSchema).mutation(async ({ input }) => {
        const result = await sessionStore.revert(input.profileId, input.sessionId);
        if (result.reverted) {
            await runtimeEventLogService.append({
                entityType: 'session',
                entityId: input.sessionId,
                eventType: 'session.reverted',
                payload: {
                    session: result.session,
                    profileId: input.profileId,
                },
            });
        }

        return result;
    }),
});
