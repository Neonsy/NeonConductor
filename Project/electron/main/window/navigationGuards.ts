import { shell } from 'electron';

import { isAppNavigation, isSafeExternalUrl } from '@/app/main/security/urlPolicy';

import type { BrowserWindow } from 'electron';

export interface NavigationGuardOptions {
    isDev: boolean;
    devServerUrl?: string;
}

export function attachNavigationGuards(win: BrowserWindow, options: NavigationGuardOptions): void {
    const { isDev, devServerUrl } = options;

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

        if (isAppNavigation(url, isDev ? devServerUrl : undefined)) {
            return;
        }

        event.preventDefault();
        if (isSafeExternalUrl(url)) {
            void shell.openExternal(url);
        } else {
            console.warn(`[security] Blocked external URL: ${url}`);
        }
    });
}
