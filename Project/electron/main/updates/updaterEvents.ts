import { app, dialog } from 'electron';
import { autoUpdater, type ProgressInfo } from 'electron-updater';

import { appLog } from '@/app/main/logging';
import type { SwitchStatusPayload, UpdateChannel } from '@/app/main/updates/statusBroadcast';
import type { ActiveUpdateFlow } from '@/app/main/updates/switchFlow';

import type { BrowserWindow } from 'electron';

interface UpdaterEventsInput {
    getCurrentChannel: () => UpdateChannel;
    getWindow: () => BrowserWindow | null;
    getActiveUpdateFlow: () => ActiveUpdateFlow | null;
    setActiveUpdateFlow: (flow: ActiveUpdateFlow | null) => void;
    getManualCheckRequested: () => boolean;
    setManualCheckRequested: (requested: boolean) => void;
    updateSwitchStatus: (patch: Partial<SwitchStatusPayload>) => void;
    scheduleStatusReset: (delayMs?: number) => void;
}

export function registerUpdaterEvents(input: UpdaterEventsInput): void {
    autoUpdater.on('checking-for-update', () => {
        if (!input.getActiveUpdateFlow()) {
            return;
        }

        input.updateSwitchStatus({
            phase: 'checking',
            percent: 0,
            message: 'Checking for updates in the selected channel...',
            canInteract: false,
        });
    });

    autoUpdater.on('update-available', () => {
        if (input.getManualCheckRequested()) {
            input.setManualCheckRequested(false);
        }

        if (!input.getActiveUpdateFlow()) {
            return;
        }

        input.updateSwitchStatus({
            phase: 'downloading',
            percent: 0,
            message: 'Downloading update... 0%',
            canInteract: false,
        });
    });

    autoUpdater.on('download-progress', (progress: ProgressInfo) => {
        input.getWindow()?.setProgressBar(progress.percent / 100);

        if (!input.getActiveUpdateFlow()) {
            return;
        }

        const rounded = Math.max(0, Math.min(100, Math.round(progress.percent)));

        input.updateSwitchStatus({
            phase: 'downloading',
            percent: rounded,
            message: `Downloading update... ${String(rounded)}%`,
            canInteract: false,
        });
    });

    autoUpdater.on('update-not-available', () => {
        input.getWindow()?.setProgressBar(-1);

        if (!input.getActiveUpdateFlow()) {
            if (input.getManualCheckRequested()) {
                input.setManualCheckRequested(false);
                const window = input.getWindow();
                if (window) {
                    void dialog.showMessageBox(window, {
                        type: 'info',
                        title: 'No Updates Available',
                        message: 'You are already on the latest build for the selected channel.',
                    });
                }
            }
            return;
        }

        const flow = input.getActiveUpdateFlow();
        input.setActiveUpdateFlow(null);
        input.setManualCheckRequested(false);

        if (!flow) {
            return;
        }

        input.updateSwitchStatus({
            phase: 'no_update',
            channel: flow.channel,
            percent: null,
            message: 'No update is available in the selected channel right now.',
            canInteract: true,
        });

        const window = input.getWindow();
        if (window && flow.source === 'switch') {
            void dialog.showMessageBox(window, {
                type: 'info',
                title: 'Channel Updated',
                message: 'No update is available in the selected channel right now.',
            });
        } else if (window && flow.source === 'manual') {
            void dialog.showMessageBox(window, {
                type: 'info',
                title: 'No Updates Available',
                message: 'You are already on the latest build for the selected channel.',
            });
        }

        input.scheduleStatusReset(500);
    });

    autoUpdater.on('update-downloaded', () => {
        input.getWindow()?.setProgressBar(-1);
        input.setManualCheckRequested(false);

        if (input.getActiveUpdateFlow()) {
            const flow = input.getActiveUpdateFlow();
            input.setActiveUpdateFlow(null);

            if (!flow) {
                return;
            }

            input.updateSwitchStatus({
                phase: 'downloaded',
                channel: flow.channel,
                percent: 100,
                message: flow.source === 'switch' ? 'Preparing restart...' : 'Update downloaded. Ready to restart.',
                canInteract: false,
            });

            const window = input.getWindow();
            if (!window) {
                input.scheduleStatusReset(300);
                return;
            }

            if (flow.source === 'switch') {
                void dialog
                    .showMessageBox(window, {
                        type: 'info',
                        title: 'Channel Switch Ready',
                        message: 'In order to complete the switch, the app needs to be restarted.',
                        buttons: ['Restart', 'Close'],
                        defaultId: 0,
                        cancelId: 1,
                        noLink: true,
                    })
                    .then(({ response }) => {
                        if (response === 0) {
                            app.removeAllListeners('window-all-closed');
                            autoUpdater.quitAndInstall(true, true);
                            return;
                        }

                        input.updateSwitchStatus({
                            phase: 'idle',
                            channel: input.getCurrentChannel(),
                            percent: null,
                            message: '',
                            canInteract: true,
                        });
                    });
            } else {
                void dialog
                    .showMessageBox(window, {
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
                            autoUpdater.quitAndInstall(true, true);
                            return;
                        }

                        input.updateSwitchStatus({
                            phase: 'idle',
                            channel: input.getCurrentChannel(),
                            percent: null,
                            message: '',
                            canInteract: true,
                        });
                    });
            }

            return;
        }

        const window = input.getWindow();
        if (!window) return;

        void dialog
            .showMessageBox(window, {
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
                    autoUpdater.quitAndInstall(true, true);
                }
            });
    });

    autoUpdater.on('error', (error) => {
        appLog.error({
            tag: 'updater',
            message: 'Auto-updater error.',
            ...(error instanceof Error ? { error: error.message } : { error: String(error) }),
        });
        input.getWindow()?.setProgressBar(-1);

        if (!input.getActiveUpdateFlow()) {
            if (input.getManualCheckRequested()) {
                input.setManualCheckRequested(false);
                const window = input.getWindow();
                if (window) {
                    void dialog.showMessageBox(window, {
                        type: 'error',
                        title: 'Update Check Failed',
                        message: 'Unable to check for updates right now.',
                    });
                }
            }
            return;
        }

        const flow = input.getActiveUpdateFlow();
        input.setActiveUpdateFlow(null);
        input.setManualCheckRequested(false);

        if (!flow) {
            return;
        }

        input.updateSwitchStatus({
            phase: 'error',
            percent: null,
            message:
                flow.source === 'switch'
                    ? 'Update failed while switching channels.'
                    : 'Update check failed while downloading the selected channel build.',
            canInteract: true,
        });

        const window = input.getWindow();
        if (window && flow.source === 'switch') {
            void dialog.showMessageBox(window, {
                type: 'error',
                title: 'Channel Switch Failed',
                message:
                    'The channel changed, but downloading an update failed. You can retry from the selected channel.',
            });
        } else if (window && flow.source === 'manual') {
            void dialog.showMessageBox(window, {
                type: 'error',
                title: 'Update Check Failed',
                message: 'An update was found, but downloading it failed. Please retry.',
            });
        }

        input.scheduleStatusReset(1200);
    });
}
