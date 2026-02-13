/**
 * System router for application-level operations.
 * Handles window management and other system tasks.
 */

import { publicProcedure, router } from '@/app/backend/trpc/init';
import { signalReady } from '@/app/backend/trpc/routers/system/signalReady';
import {
    closeWindow,
    getWindowState,
    minimizeWindow,
    showWindowMenu,
    toggleMaximizeWindow,
} from '@/app/backend/trpc/routers/system/windowControls';

export const systemRouter = router({
    // Called by renderer when React has rendered, to show the window
    signalReady: publicProcedure.mutation(({ ctx }) => signalReady(ctx.win)),
    // Custom title bar controls via existing tRPC IPC channel
    getWindowState: publicProcedure.query(({ ctx }) => getWindowState(ctx.win)),
    minimizeWindow: publicProcedure.mutation(({ ctx }) => minimizeWindow(ctx.win)),
    toggleMaximizeWindow: publicProcedure.mutation(({ ctx }) => toggleMaximizeWindow(ctx.win)),
    closeWindow: publicProcedure.mutation(({ ctx }) => closeWindow(ctx.win)),
    showWindowMenu: publicProcedure.mutation(({ ctx }) => showWindowMenu(ctx.win)),
});
