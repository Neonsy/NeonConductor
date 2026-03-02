import {
    permissionDecisionInputSchema,
    permissionRequestInputSchema,
} from '@/app/backend/runtime/contracts';
import { createPermissionRecord, getRuntimeState } from '@/app/backend/runtime/state';
import { publicProcedure, router } from '@/app/backend/trpc/init';

export const permissionRouter = router({
    request: publicProcedure.input(permissionRequestInputSchema).mutation(({ input }) => {
        const state = getRuntimeState();
        const record = createPermissionRecord(input.policy, input.resource, input.rationale);

        state.permissions.set(record.id, record);

        return { request: record };
    }),
    listPending: publicProcedure.query(() => {
        const state = getRuntimeState();
        const requests = [...state.permissions.values()]
            .filter((item) => item.decision === 'pending')
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

        return { requests };
    }),
    grant: publicProcedure.input(permissionDecisionInputSchema).mutation(({ input }) => {
        const state = getRuntimeState();
        const record = state.permissions.get(input.requestId);
        if (!record) {
            return { updated: false as const, reason: 'not_found' as const };
        }
        if (record.decision === 'granted') {
            return { updated: false as const, reason: 'already_granted' as const, request: record };
        }

        record.decision = 'granted';
        record.updatedAt = new Date().toISOString();

        return { updated: true as const, reason: null, request: record };
    }),
    deny: publicProcedure.input(permissionDecisionInputSchema).mutation(({ input }) => {
        const state = getRuntimeState();
        const record = state.permissions.get(input.requestId);
        if (!record) {
            return { updated: false as const, reason: 'not_found' as const };
        }
        if (record.decision === 'denied') {
            return { updated: false as const, reason: 'already_denied' as const, request: record };
        }

        record.decision = 'denied';
        record.updatedAt = new Date().toISOString();

        return { updated: true as const, reason: null, request: record };
    }),
});
