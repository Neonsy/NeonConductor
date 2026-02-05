/**
 * Root tRPC router.
 * Mounts all domain routers here; AppRouter type is exported for client inference.
 */

import { router } from '@/app/backend/trpc/init';
import { systemRouter } from '@/app/backend/trpc/routers/system';

export const appRouter = router({
    system: systemRouter,
});

export type AppRouter = typeof appRouter;
