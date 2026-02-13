/**
 * Electron main process entry point.
 * Bootstraps the app lifecycle orchestration.
 */

import { createContext } from '@/app/backend/trpc/context';
import { appRouter } from '@/app/backend/trpc/router';
import { bootstrapMainProcess } from '@/app/main/bootstrap';
import { initAutoUpdater } from '@/app/main/updates/updater';

bootstrapMainProcess(
    {
        createContext,
        appRouter,
        initAutoUpdater,
    },
    import.meta.url
);
