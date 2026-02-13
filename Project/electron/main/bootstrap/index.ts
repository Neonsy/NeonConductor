import { app, BrowserWindow, Menu } from 'electron';
import { createIPCHandler, type CreateContextOptions } from 'electron-trpc-experimental/main';

import type { Context } from '@/app/backend/trpc/context';
import type { AppRouter } from '@/app/backend/trpc/router';
import { flushAppLogger, initAppLogger } from '@/app/main/logging';
import { devServerUrl, getMainDirname, isDev } from '@/app/main/runtime/env';
import { attachCspHeaders } from '@/app/main/security/cspHeaders';
import { createMainWindow } from '@/app/main/window/factory';

interface BootstrapDeps {
    createContext: (opts: CreateContextOptions) => Promise<Context>;
    appRouter: AppRouter;
    initAutoUpdater: () => void;
}

export function bootstrapMainProcess(deps: BootstrapDeps, importMetaUrl: string): void {
    const { createContext, appRouter, initAutoUpdater } = deps;
    const mainDirname = getMainDirname(importMetaUrl);

    let mainWindow: BrowserWindow | null = null;
    let ipcHandler: ReturnType<typeof createIPCHandler> | null = null;
    const runtimeWindowOptions = {
        isDev,
        mainDirname,
        ...(devServerUrl ? { devServerUrl } : {}),
    };
    const runtimeCspOptions = {
        isDev,
        ...(devServerUrl ? { devServerUrl } : {}),
    };

    void app.whenReady().then(() => {
        initAppLogger({
            isDev,
            version: app.getVersion(),
        });

        // Remove default menu bar (File, Edit, View, Help)
        Menu.setApplicationMenu(null);

        // Set up Content Security Policy via HTTP headers.
        attachCspHeaders(runtimeCspOptions);

        mainWindow = createMainWindow(runtimeWindowOptions);

        // Wire up tRPC to handle IPC calls from the renderer
        ipcHandler = createIPCHandler({
            router: appRouter,
            windows: [mainWindow],
            createContext,
        });

        app.on('browser-window-created', (_event, window) => {
            ipcHandler?.attachWindow(window);
        });

        initAutoUpdater();
    });

    app.on('before-quit', () => {
        void flushAppLogger();
    });

    // Standard quit behavior: exit when all windows closed (except macOS)
    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });

    // macOS: re-create window when dock icon clicked with no windows open
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            mainWindow = createMainWindow({
                ...runtimeWindowOptions,
            });
        }
    });
}
