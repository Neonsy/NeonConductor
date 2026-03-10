import path from 'node:path';

export const MAIN_WINDOW_PRELOAD_BUNDLE_NAME = 'mainWindow.js';
export const SPLASH_WINDOW_PRELOAD_BUNDLE_NAME = 'splashWindow.js';

export function resolveMainWindowPreloadPath(mainDirname: string): string {
    return path.join(mainDirname, MAIN_WINDOW_PRELOAD_BUNDLE_NAME);
}

export function resolveSplashWindowPreloadPath(mainDirname: string): string {
    return path.join(mainDirname, SPLASH_WINDOW_PRELOAD_BUNDLE_NAME);
}
