/**
 * Auto-updater setup.
 * Checks for updates on startup, downloads silently, prompts user when ready.
 * Requires a publish provider configured in electron-builder.json5.
 */

import { app, BrowserWindow, dialog } from 'electron';
import { autoUpdater, type ProgressInfo } from 'electron-updater';

let mainWindow: BrowserWindow | null = null;

export function initAutoUpdater(): void {
    if (!app.isPackaged && process.env['UPDATER_ENABLED'] !== '1') {
        return;
    }

    mainWindow = BrowserWindow.getAllWindows()[0] ?? null;

    const version = app.getVersion();
    const isAlpha = version.includes('-alpha.');
    const isBeta = version.includes('-beta.');

    if (isAlpha) {
        autoUpdater.channel = 'alpha';
    } else if (isBeta) {
        autoUpdater.channel = 'beta';
    } else {
        autoUpdater.channel = 'latest';
    }

    autoUpdater.allowPrerelease = isAlpha || isBeta;

    // === DEFAULT: Background download, prompt when ready ===
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true; // Install on quit if user chose "Later"

    // Show native taskbar/dock progress during download
    autoUpdater.on('download-progress', (progress: ProgressInfo) => {
        mainWindow?.setProgressBar(progress.percent / 100);
    });

    // Prompt user when download completes
    autoUpdater.on('update-downloaded', () => {
        mainWindow?.setProgressBar(-1);

        // If no window available, skip dialog (autoInstallOnAppQuit handles it)
        if (!mainWindow) return;

        void dialog
            .showMessageBox(mainWindow, {
                type: 'info',
                title: 'Update Ready',
                message: 'A new version has been downloaded.',
                detail: 'Would you like to restart now to install the update, or install it when you quit?',
                buttons: ['Restart Now', 'Later'],
                defaultId: 0,
                cancelId: 1,
            })
            .then(({ response }) => {
                if (response === 0) {
                    app.removeAllListeners('window-all-closed');
                    autoUpdater.quitAndInstall(false, true);
                }
                // If "Later", autoInstallOnAppQuit handles it
            });
    });

    autoUpdater.on('error', (error) => {
        console.error('Auto-updater error:', error);
        mainWindow?.setProgressBar(-1);
    });

    void autoUpdater.checkForUpdates();

    // === ALTERNATIVE: Prompt before download ===
    // To use this approach instead, comment out the DEFAULT section above and uncomment below:
    //
    // autoUpdater.autoDownload = false;
    //
    // autoUpdater.on('update-available', (info) => {
    //     void dialog
    //         .showMessageBox(mainWindow!, {
    //             type: 'info',
    //             title: 'Update Available',
    //             message: `Version ${info.version} is available.`,
    //             detail: 'Would you like to download and install it now?',
    //             buttons: ['Download and Install', 'Not Now'],
    //             defaultId: 0,
    //             cancelId: 1,
    //         })
    //         .then(({ response }) => {
    //             if (response === 0) {
    //                 void autoUpdater.downloadUpdate();
    //             }
    //         });
    // });
    //
    // autoUpdater.on('update-downloaded', () => {
    //     mainWindow?.setProgressBar(-1);
    //     app.removeAllListeners('window-all-closed');
    //     autoUpdater.quitAndInstall(false, true);
    // });
}
