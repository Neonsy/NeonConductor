/*
Why: Single TanStack Router configured with hash history for Electron; routeTree is generated and centralizes navigation.
*/

import { createHashHistory, createRouter } from '@tanstack/react-router';

import { routeTree } from '@/web/routeTree.gen';

export const router = createRouter({ routeTree, history: createHashHistory() });
export type AppRouter = typeof router;

declare module '@tanstack/react-router' {
    interface Register {
        router: AppRouter;
    }
}
