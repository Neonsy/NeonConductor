/**
 * Root tRPC router.
 * Mounts all domain routers here; AppRouter type is exported for client inference.
 */

import { mcpRouter } from '@/app/backend/trpc/routers/mcp';
import { permissionRouter } from '@/app/backend/trpc/routers/permission';
import { providerRouter } from '@/app/backend/trpc/routers/provider';
import { sessionRouter } from '@/app/backend/trpc/routers/session';
import { router } from '@/app/backend/trpc/init';
import { systemRouter } from '@/app/backend/trpc/routers/system';
import { toolRouter } from '@/app/backend/trpc/routers/tool';
import { updatesRouter } from '@/app/backend/trpc/routers/updates';

export const appRouter = router({
    session: sessionRouter,
    provider: providerRouter,
    permission: permissionRouter,
    tool: toolRouter,
    mcp: mcpRouter,
    system: systemRouter,
    updates: updatesRouter,
});

export type AppRouter = typeof appRouter;
