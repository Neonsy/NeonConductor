/**
 * Electron main process entry point.
 * Bootstraps the app window, tRPC IPC handler, and auto-updater.
 */

import { app, BrowserWindow, Menu, session, shell } from 'electron';
import { createIPCHandler } from 'electron-trpc-experimental/main';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createContext } from '@/app/backend/trpc/context';
import { appRouter } from '@/app/backend/trpc/router';
import { getCspHeader } from '@/app/csp';
import { isAppNavigation, isSafeExternalUrl } from '@/app/security';
import { initAutoUpdater } from '@/app/updater';

// ESM doesn't provide __dirname, so we derive it from import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Vite injects this env var during dev; its presence indicates dev mode
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];
const isDev = !!VITE_DEV_SERVER_URL;

let mainWindow: BrowserWindow | null = null;
let ipcHandler: ReturnType<typeof createIPCHandler> | null = null;

function createWindow(): BrowserWindow {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 960,
        minHeight: 540,
        show: false, // Prevent flash before maximize
        backgroundColor: '#0a0a0f', // Match app background to prevent white flash
        webPreferences: {
            preload: path.join(__dirname, 'preload.mjs'),
            // Security hardening: isolate renderer from Node.js
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            // Disable devtools in production to prevent inspection
            devTools: isDev,
        },
    });

    // Window showing is handled by tRPC system.signalReady mutation
    // This ensures the window only appears after React has actually rendered content,
    // preventing the blank flash that occurs with simpler approaches like 'ready-to-show'.

    if (isDev) {
        void win.loadURL(VITE_DEV_SERVER_URL);
        // Detached devtools avoids layout interference during development
        win.webContents.openDevTools({ mode: 'detach' });
    } else {
        void win.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    const fallbackTimer = setTimeout(() => {
        if (!win.isVisible()) {
            console.warn('[window] Renderer did not signal ready in time; showing window fallback.');
            win.show();
        }
    }, 3000);

    win.on('show', () => {
        clearTimeout(fallbackTimer);
    });

    // Security: intercept target="_blank" and window.open() to use OS browser
    win.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('devtools://')) {
            return { action: 'allow' };
        }

        if (isSafeExternalUrl(url)) {
            void shell.openExternal(url);
        } else {
            console.warn(`[security] Blocked external URL: ${url}`);
        }
        return { action: 'deny' };
    });

    // Security: prevent in-app navigation to external URLs
    win.webContents.on('will-navigate', (event, url) => {
        if (url.startsWith('devtools://')) {
            return;
        }

        if (isAppNavigation(url, isDev ? VITE_DEV_SERVER_URL : undefined)) {
            return;
        }

        event.preventDefault();
        if (isSafeExternalUrl(url)) {
            void shell.openExternal(url);
        } else {
            console.warn(`[security] Blocked external URL: ${url}`);
        }
    });

    return win;
}

/**
 * Sets up Content Security Policy for the app.
 * Injects CSP headers into all responses from the app's own content.
 *
 * This approach uses session.webRequest.onHeadersReceived to add CSP headers
 * dynamically, which is the recommended pattern for Electron apps.
 */
function setupContentSecurityPolicy(): void {
    const cspHeader = getCspHeader(isDev ? 'dev' : 'prod', { devServerUrl: VITE_DEV_SERVER_URL });

    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        // Only apply CSP to our app's content, not external resources or devtools
        const isAppContent = isDev
            ? Boolean(VITE_DEV_SERVER_URL && details.url.startsWith(VITE_DEV_SERVER_URL))
            : details.url.startsWith('file://');

        // Skip devtools URLs
        const isDevTools = details.url.startsWith('devtools://');

        if (isAppContent && !isDevTools) {
            callback({
                responseHeaders: {
                    ...details.responseHeaders,
                    'Content-Security-Policy': [cspHeader],
                },
            });
        } else {
            callback({});
        }
    });
}

void app.whenReady().then(() => {
    // Remove default menu bar (File, Edit, View, Help)
    Menu.setApplicationMenu(null);

    // Set up Content Security Policy via HTTP headers
    // This intercepts all responses and injects the CSP header for app content
    setupContentSecurityPolicy();

    mainWindow = createWindow();

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

// Standard quit behavior: exit when all windows closed (except macOS)
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// macOS: re-create window when dock icon clicked with no windows open
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createWindow();
    }
});
