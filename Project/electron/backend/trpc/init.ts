/**
 * tRPC initialization.
 * Creates the base router and procedure builders used by all routers.
 */

import { initTRPC } from '@trpc/server';

import type { Context } from '@/app/backend/trpc/context';

const t = initTRPC.context<Context>().create({
    // Marks this as server-side (main process) for tRPC internals
    isServer: true,
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const middleware = t.middleware;
