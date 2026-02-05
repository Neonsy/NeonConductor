/**
 * System router for application-level operations.
 * Handles window management and other system tasks.
 */

import { publicProcedure, router } from '@/app/backend/trpc/init';

import { signalReady } from './signalReady';

export const systemRouter = router({
    // Called by renderer when React has rendered, to show the window
    signalReady: publicProcedure.mutation(({ ctx }) => signalReady(ctx.win)),
});
