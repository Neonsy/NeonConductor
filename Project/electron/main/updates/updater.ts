/**
 * Auto-updater setup with release-channel switching support.
 * Supports stable/beta/alpha channels, persisted channel preference,
 * and switch status reporting for renderer UI.
 */

import { app, BrowserWindow, dialog } from 'electron';
import Store from 'electron-store';
import { autoUpdater, type ProgressInfo } from 'electron-updater';
import { err, ok, type Result } from 'neverthrow';

import { appLog } from '@/app/main/logging';
import {
    checkForUpdatesForSelectedChannel as checkUpdaterForSelectedChannel,
    configureFeedForChannel as configureUpdaterFeedForChannel,
    type CachedFeedConfig,
    type ConfigureFeedOptions,
    type UpdaterOperationError,
} from '@/app/main/updates/feedControl';

export type UpdateChannel = 'stable' | 'beta' | 'alpha';

export type SwitchStatusPhase = 'idle' | 'warning' | 'checking' | 'downloading' | 'downloaded' | 'no_update' | 'error';

export interface SwitchStatusPayload {
    phase: SwitchStatusPhase;
    channel: UpdateChannel;
    percent: number | null;
    message: string;
    canInteract: boolean;
}

export interface SwitchChannelResult {
    channel: UpdateChannel;
    changed: boolean;
    cancelled: boolean;
    checkStarted: boolean;
    message: string;
}

interface PersistedChannelState {
    channel: UpdateChannel;
    exists: boolean;
}

interface ActiveUpdateFlow {
    source: 'switch' | 'manual';
    channel: UpdateChannel;
}

const DEFAULT_CHANNEL: UpdateChannel = 'stable';

let mainWindow: BrowserWindow | null = null;
let initialized = false;
let currentChannel: UpdateChannel = DEFAULT_CHANNEL;
let activeUpdateFlow: ActiveUpdateFlow | null = null;
let resetStatusTimer: NodeJS.Timeout | null = null;
let channelStore: Store<{ channel?: UpdateChannel }> | null = null;
let manualCheckRequested = false;
const resolvedFeedCache = new Map<UpdateChannel, CachedFeedConfig>();

let switchStatus: SwitchStatusPayload = {
    phase: 'idle',
    channel: DEFAULT_CHANNEL,
    percent: null,
    message: '',
    canInteract: true,
};

function isUpdaterEnabled(): boolean {
    return app.isPackaged || process.env['UPDATER_ENABLED'] === '1';
}

function isUpdateChannel(value: unknown): value is UpdateChannel {
    return value === 'stable' || value === 'beta' || value === 'alpha';
}

function getWindow(): BrowserWindow | null {
    if (mainWindow && !mainWindow.isDestroyed()) {
        return mainWindow;
    }

    mainWindow = BrowserWindow.getAllWindows()[0] ?? null;
    return mainWindow;
}

function scheduleStatusReset(delayMs = 300): void {
    if (resetStatusTimer) {
        clearTimeout(resetStatusTimer);
    }

    resetStatusTimer = setTimeout(() => {
        switchStatus = {
            phase: 'idle',
            channel: currentChannel,
            percent: null,
            message: '',
            canInteract: true,
        };
    }, delayMs);
}

function updateSwitchStatus(patch: Partial<SwitchStatusPayload>): void {
    if (resetStatusTimer) {
        clearTimeout(resetStatusTimer);
        resetStatusTimer = null;
    }

    switchStatus = {
        ...switchStatus,
        channel: currentChannel,
        ...patch,
    };
}

function toUpdaterChannel(channel: UpdateChannel): 'latest' | 'beta' | 'alpha' {
    if (channel === 'stable') return 'latest';
    return channel;
}

function applyChannel(channel: UpdateChannel): void {
    currentChannel = channel;
    autoUpdater.channel = toUpdaterChannel(channel);
    autoUpdater.allowPrerelease = channel !== 'stable';
}

function getChannelStore(): Store<{ channel?: UpdateChannel }> {
    if (channelStore) {
        return channelStore;
    }

    channelStore = new Store<{ channel?: UpdateChannel }>({
        name: 'updater-channel',
    });

    return channelStore;
}

function loadPersistedChannel(): PersistedChannelState {
    try {
        const store = getChannelStore();

        if (!store.has('channel')) {
            return { channel: DEFAULT_CHANNEL, exists: false };
        }

        const persisted = store.get('channel');
        if (isUpdateChannel(persisted)) {
            return { channel: persisted, exists: true };
        }

        appLog.error({
            tag: 'updater',
            message: 'Persisted channel is invalid. Re-seeding from stable default.',
        });
        return { channel: DEFAULT_CHANNEL, exists: false };
    } catch (error) {
        appLog.error({
            tag: 'updater',
            message: 'Failed to read persisted channel.',
            ...(error instanceof Error ? { error: error.message } : { error: String(error) }),
        });
    }

    return { channel: DEFAULT_CHANNEL, exists: false };
}

export function resolvePersistedUpdateChannel(): UpdateChannel {
    return loadPersistedChannel().channel;
}

function persistChannel(channel: UpdateChannel): void {
    getChannelStore().set('channel', channel);
}

async function configureFeedForChannel(
    channel: UpdateChannel,
    options: ConfigureFeedOptions = {}
): ReturnType<typeof configureUpdaterFeedForChannel> {
    return configureUpdaterFeedForChannel({
        channel,
        options,
        resolvedFeedCache,
        applyChannel,
        toUpdaterChannel,
        updaterClient: autoUpdater,
        logger: appLog,
    });
}

async function checkForUpdatesForSelectedChannel(
    channel: UpdateChannel,
    options: ConfigureFeedOptions = {}
): ReturnType<typeof checkUpdaterForSelectedChannel> {
    return checkUpdaterForSelectedChannel({
        channel,
        options,
        resolvedFeedCache,
        applyChannel,
        toUpdaterChannel,
        updaterClient: autoUpdater,
        logger: appLog,
    });
}

function startSwitchFlow(channel: UpdateChannel, options: { feedConfigured?: boolean } = {}): void {
    activeUpdateFlow = {
        source: 'switch',
        channel,
    };
    updateSwitchStatus({
        phase: 'checking',
        channel,
        percent: 0,
        message: 'Checking for updates in the selected channel...',
        canInteract: false,
    });

    const checkPromise: Promise<Result<void, UpdaterOperationError>> = options.feedConfigured
        ? autoUpdater
              .checkForUpdates()
              .then(() => ok(undefined))
              .catch(() =>
                  err({
                      code: 'check_failed',
                      message: 'Failed to check for updates in the selected channel.',
                  })
              )
        : checkForUpdatesForSelectedChannel(channel, {
              forceRefresh: true,
              applyResolvedChannel: false,
          });

    void checkPromise.then((result) => {
        if (result.isOk()) {
            return;
        }

        appLog.error({
            tag: 'updater',
            message: 'Failed to check for updates after channel switch.',
            code: result.error.code,
            error: result.error.message,
        });
        activeUpdateFlow = null;
        updateSwitchStatus({
            phase: 'error',
            percent: null,
            message: 'Failed to check for updates in the selected channel.',
            canInteract: true,
        });
        scheduleStatusReset(1200);

        const window = getWindow();
        if (window) {
            void dialog.showMessageBox(window, {
                type: 'error',
                title: 'Channel Switch Failed',
                message: 'Failed to check for updates for the selected channel.',
            });
        }
    });
}

export function getCurrentChannel(): UpdateChannel {
    return currentChannel;
}

export function getSwitchStatusSnapshot(): SwitchStatusPayload {
    return { ...switchStatus };
}

export async function checkForUpdatesManually(): Promise<{ started: boolean; message: string }> {
    if (!isUpdaterEnabled()) {
        return {
            started: false,
            message: 'Updater is disabled in development builds.',
        };
    }

    if (activeUpdateFlow) {
        return {
            started: false,
            message: 'An update action is already in progress.',
        };
    }

    manualCheckRequested = true;
    activeUpdateFlow = {
        source: 'manual',
        channel: currentChannel,
    };
    updateSwitchStatus({
        phase: 'checking',
        channel: currentChannel,
        percent: 0,
        message: 'Checking for updates in the selected channel...',
        canInteract: false,
    });

    const checkResult = await checkForUpdatesForSelectedChannel(currentChannel, {
        forceRefresh: true,
        applyResolvedChannel: true,
    });

    if (checkResult.isOk()) {
        return {
            started: true,
            message: 'Checking for updates in the selected channel...',
        };
    }

    activeUpdateFlow = null;
    manualCheckRequested = false;
    appLog.error({
        tag: 'updater',
        message: 'Manual update check failed.',
        code: checkResult.error.code,
        error: checkResult.error.message,
    });
    updateSwitchStatus({
        phase: 'error',
        percent: null,
        message: 'Failed to check for updates in the selected channel.',
        canInteract: true,
    });
    scheduleStatusReset(1200);

    const window = getWindow();
    if (window) {
        void dialog.showMessageBox(window, {
            type: 'error',
            title: 'Update Check Failed',
            message: 'Unable to check for updates in the selected channel right now.',
        });
    }

    return {
        started: false,
        message: 'Failed to check for updates.',
    };
}

export async function switchChannel(channel: UpdateChannel): Promise<SwitchChannelResult> {
    if (!isUpdaterEnabled()) {
        return {
            channel: currentChannel,
            changed: false,
            cancelled: false,
            checkStarted: false,
            message: 'Updater is disabled in development builds.',
        };
    }

    if (channel === currentChannel) {
        return {
            channel,
            changed: false,
            cancelled: false,
            checkStarted: false,
            message: 'This channel is already selected.',
        };
    }

    const window = getWindow();

    updateSwitchStatus({
        phase: 'warning',
        channel,
        percent: null,
        message: 'Switching channel...',
        canInteract: false,
    });

    const configureResult = await configureFeedForChannel(channel, {
        forceRefresh: true,
        applyResolvedChannel: false,
    });

    if (configureResult.isErr()) {
        appLog.error({
            tag: 'updater',
            message: 'Channel switch failed during feed configuration.',
            code: configureResult.error.code,
            error: configureResult.error.message,
            channel,
        });
        updateSwitchStatus({
            phase: 'error',
            channel: currentChannel,
            percent: null,
            message: 'Failed to resolve updates for the selected channel.',
            canInteract: true,
        });
        scheduleStatusReset(1200);

        if (window) {
            void dialog.showMessageBox(window, {
                type: 'error',
                title: 'Channel Switch Failed',
                message: 'Unable to resolve updates for the selected channel from GitHub releases.',
            });
        }

        return {
            channel: currentChannel,
            changed: false,
            cancelled: false,
            checkStarted: false,
            message: 'Failed to resolve selected channel updates.',
        };
    }

    persistChannel(channel);
    applyChannel(channel);
    startSwitchFlow(channel, { feedConfigured: true });

    return {
        channel,
        changed: true,
        cancelled: false,
        checkStarted: true,
        message: 'Channel switched. Checking for updates now.',
    };
}

export function initAutoUpdater(): void {
    if (!isUpdaterEnabled()) {
        return;
    }

    mainWindow = BrowserWindow.getAllWindows()[0] ?? null;

    if (initialized) {
        return;
    }

    initialized = true;

    const persistedChannel = loadPersistedChannel();

    if (!persistedChannel.exists) {
        persistChannel(DEFAULT_CHANNEL);
        currentChannel = DEFAULT_CHANNEL;
    } else {
        currentChannel = persistedChannel.channel;
    }

    applyChannel(currentChannel);

    switchStatus = {
        phase: 'idle',
        channel: currentChannel,
        percent: null,
        message: '',
        canInteract: true,
    };

    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('checking-for-update', () => {
        if (!activeUpdateFlow) {
            return;
        }

        updateSwitchStatus({
            phase: 'checking',
            percent: 0,
            message: 'Checking for updates in the selected channel...',
            canInteract: false,
        });
    });

    autoUpdater.on('update-available', () => {
        if (manualCheckRequested) {
            manualCheckRequested = false;
        }

        if (!activeUpdateFlow) {
            return;
        }

        updateSwitchStatus({
            phase: 'downloading',
            percent: 0,
            message: 'Downloading update... 0%',
            canInteract: false,
        });
    });

    autoUpdater.on('download-progress', (progress: ProgressInfo) => {
        getWindow()?.setProgressBar(progress.percent / 100);

        if (!activeUpdateFlow) {
            return;
        }

        const rounded = Math.max(0, Math.min(100, Math.round(progress.percent)));

        updateSwitchStatus({
            phase: 'downloading',
            percent: rounded,
            message: `Downloading update... ${String(rounded)}%`,
            canInteract: false,
        });
    });

    autoUpdater.on('update-not-available', () => {
        getWindow()?.setProgressBar(-1);

        if (!activeUpdateFlow) {
            if (manualCheckRequested) {
                manualCheckRequested = false;
                const window = getWindow();
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

        const flow = activeUpdateFlow;
        activeUpdateFlow = null;
        manualCheckRequested = false;

        updateSwitchStatus({
            phase: 'no_update',
            channel: flow.channel,
            percent: null,
            message: 'No update is available in the selected channel right now.',
            canInteract: true,
        });

        const window = getWindow();
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

        scheduleStatusReset(500);
    });

    autoUpdater.on('update-downloaded', () => {
        getWindow()?.setProgressBar(-1);
        manualCheckRequested = false;

        if (activeUpdateFlow) {
            const flow = activeUpdateFlow;
            activeUpdateFlow = null;

            updateSwitchStatus({
                phase: 'downloaded',
                channel: flow.channel,
                percent: 100,
                message: flow.source === 'switch' ? 'Preparing restart...' : 'Update downloaded. Ready to restart.',
                canInteract: false,
            });

            const window = getWindow();
            if (!window) {
                scheduleStatusReset(300);
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

                        updateSwitchStatus({
                            phase: 'idle',
                            channel: currentChannel,
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

                        updateSwitchStatus({
                            phase: 'idle',
                            channel: currentChannel,
                            percent: null,
                            message: '',
                            canInteract: true,
                        });
                    });
            }

            return;
        }

        const window = getWindow();
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
        getWindow()?.setProgressBar(-1);

        if (!activeUpdateFlow) {
            if (manualCheckRequested) {
                manualCheckRequested = false;
                const window = getWindow();
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

        const flow = activeUpdateFlow;
        activeUpdateFlow = null;
        manualCheckRequested = false;

        updateSwitchStatus({
            phase: 'error',
            percent: null,
            message:
                flow.source === 'switch'
                    ? 'Update failed while switching channels.'
                    : 'Update check failed while downloading the selected channel build.',
            canInteract: true,
        });

        const window = getWindow();
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

        scheduleStatusReset(1200);
    });

    void checkForUpdatesForSelectedChannel(currentChannel, {
        forceRefresh: true,
        applyResolvedChannel: true,
    }).then((result) => {
        if (result.isOk()) {
            return;
        }

        appLog.error({
            tag: 'updater',
            message: 'Auto-updater initial check failed.',
            code: result.error.code,
            error: result.error.message,
        });
    });
}
