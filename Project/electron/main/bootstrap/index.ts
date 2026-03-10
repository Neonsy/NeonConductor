import { app, BrowserWindow, Menu } from 'electron';
import { createIPCHandler, type CreateContextOptions } from 'electron-trpc-experimental/main';

import { closePersistence, initializePersistence } from '@/app/backend/persistence/db';
import { getSecretStoreInfo, initializeSecretStore } from '@/app/backend/secrets/store';
import type { Context } from '@/app/backend/trpc/context';
import type { AppRouter } from '@/app/backend/trpc/router';
import { registerWindowStateBridge } from '@/app/backend/trpc/routers/system/windowControls';
import { handleStartupFailure } from '@/app/main/bootstrap/startupFailure';
import { appLog, flushAppLogger, initAppLogger } from '@/app/main/logging';
import { devServerUrl, getMainDirname, isDev } from '@/app/main/runtime/env';
import { resolveDesktopStorage, resolveDesktopStoragePaths } from '@/app/main/runtime/storage';
import { attachCspHeaders } from '@/app/main/security/cspHeaders';
import { registerBootWindows } from '@/app/main/window/bootCoordinator';
import { createMainWindow } from '@/app/main/window/factory';
import { createSplashWindow, updateSplashWindowPhase } from '@/app/main/window/splash';

interface BootstrapDeps {
    createContext: (opts: CreateContextOptions) => Promise<Context>;
    appRouter: AppRouter;
    initAutoUpdater: () => void;
    resolvePersistenceChannel: () => 'stable' | 'beta' | 'alpha';
}

export function bootstrapMainProcess(deps: BootstrapDeps, importMetaUrl: string): void {
    const { createContext, appRouter, initAutoUpdater, resolvePersistenceChannel } = deps;
    const mainDirname = getMainDirname(importMetaUrl);
    const defaultUserDataPath = app.getPath('userData');
    const initialStorage = resolveDesktopStorage({
        defaultUserDataPath,
        isDev,
        packagedRuntimeNamespace: 'stable',
    });

    if (initialStorage.isDevIsolatedStorage) {
        app.setPath('userData', initialStorage.userDataPath);
    }

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

    function createBootManagedMainWindow(): BrowserWindow {
        const splashWindow = createSplashWindow(runtimeWindowOptions);
        const nextMainWindow = createMainWindow(runtimeWindowOptions);
        registerBootWindows({
            mainWindow: nextMainWindow,
            splashWindow,
            onDelayedSplash: () => {
                void updateSplashWindowPhase(splashWindow, runtimeWindowOptions, 'delayed');
            },
        });
        return nextMainWindow;
    }

    void app
        .whenReady()
        .then(() => {
            initAppLogger({
                isDev,
                version: app.getVersion(),
            });

            const resolvedStorage = resolveDesktopStorage({
                defaultUserDataPath,
                isDev,
                packagedRuntimeNamespace: isDev ? 'stable' : resolvePersistenceChannel(),
            });
            const storagePaths = resolveDesktopStoragePaths(resolvedStorage);
            process.env['NEONCONDUCTOR_USER_DATA_PATH'] = resolvedStorage.userDataPath;
            process.env['NEONCONDUCTOR_RUNTIME_NAMESPACE'] = resolvedStorage.runtimeNamespace;
            process.env['NEONCONDUCTOR_PERSISTENCE_CHANNEL'] = resolvedStorage.runtimeNamespace;
            appLog.info({
                tag: 'runtime',
                message: 'Runtime storage resolved.',
                runtimeNamespace: resolvedStorage.runtimeNamespace,
                userDataPath: resolvedStorage.userDataPath,
                dbPath: storagePaths.dbPath,
                isDevIsolatedStorage: resolvedStorage.isDevIsolatedStorage,
            });

            initializePersistence({
                dbPath: storagePaths.dbPath,
            });
            initializeSecretStore();
            const secretStoreInfo = getSecretStoreInfo();
            appLog.info({
                tag: 'secrets',
                message: 'Provider secrets initialized.',
                backend: secretStoreInfo.backend,
            });

            // Remove default menu bar (File, Edit, View, Help)
            Menu.setApplicationMenu(null);

            // Set up Content Security Policy via HTTP headers.
            attachCspHeaders(runtimeCspOptions);

            mainWindow = createBootManagedMainWindow();
            registerWindowStateBridge(mainWindow);

            // Wire up tRPC to handle IPC calls from the renderer
            ipcHandler = createIPCHandler({
                router: appRouter,
                windows: [mainWindow],
                createContext,
            });

            app.on('browser-window-created', (_event, window) => {
                ipcHandler?.attachWindow(window);
                registerWindowStateBridge(window);
            });

            initAutoUpdater();
        })
        .catch((error: unknown) => handleStartupFailure(error));

    app.on('before-quit', () => {
        closePersistence();
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
            mainWindow = createBootManagedMainWindow();
            registerWindowStateBridge(mainWindow);
        }
    });
}
