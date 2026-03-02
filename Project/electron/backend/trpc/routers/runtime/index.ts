import { runtimeEventsQueryInputSchema } from '@/app/backend/runtime/contracts';
import { runtimeEventLogService } from '@/app/backend/runtime/services/runtimeEventLog';
import { runtimeSnapshotService } from '@/app/backend/runtime/services/runtimeSnapshot';
import { publicProcedure, router } from '@/app/backend/trpc/init';

const DEFAULT_EVENTS_LIMIT = 100;
const MAX_EVENTS_LIMIT = 500;

export const runtimeRouter = router({
    getSnapshot: publicProcedure.query(async () => {
        return runtimeSnapshotService.getSnapshot();
    }),
    getEvents: publicProcedure.input(runtimeEventsQueryInputSchema).query(async ({ input }) => {
        const requestedLimit = input.limit ?? DEFAULT_EVENTS_LIMIT;
        const limit = Math.min(MAX_EVENTS_LIMIT, Math.max(1, requestedLimit));
        const afterSequence = input.afterSequence ?? null;

        const events = await runtimeEventLogService.getEvents(afterSequence, limit);

        return {
            events,
        };
    }),
});

