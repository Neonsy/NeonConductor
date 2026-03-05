/**
 * Auto-updater setup with release-channel switching support.
 * Supports stable/beta/alpha channels, persisted channel preference,
 * and switch status reporting for renderer UI.
 */

import { app, BrowserWindow, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';

import { appLog } from '@/app/main/logging';
import { DEFAULT_CHANNEL, loadPersistedChannel, persistChannel } from '@/app/main/updates/channelState';
import {
    checkForUpdatesForSelectedChannel as checkUpdaterForSelectedChannel,
    configureFeedForChannel as configureUpdaterFeedForChannel,
    type CachedFeedConfig,
    type ConfigureFeedOptions,
} from '@/app/main/updates/feedControl';
import {
    createSwitchStatusController,
    type SwitchStatusPayload,
    type UpdateChannel as BroadcastUpdateChannel,
} from '@/app/main/updates/statusBroadcast';
import { startSwitchFlow, type ActiveUpdateFlow } from '@/app/main/updates/switchFlow';
import { registerUpdaterEvents } from '@/app/main/updates/updaterEvents';

export type UpdateChannel = BroadcastUpdateChannel;

export type { SwitchStatusPayload };

export interface SwitchChannelResult {
    channel: UpdateChannel;
    changed: boolean;
    cancelled: boolean;
    checkStarted: boolean;
    message: string;
}

let mainWindow: BrowserWindow | null = null;
let initialized = false;
let currentChannel: UpdateChannel = DEFAULT_CHANNEL;
let activeUpdateFlow: ActiveUpdateFlow | null = null;
let manualCheckRequested = false;
const resolvedFeedCache = new Map<UpdateChannel, CachedFeedConfig>();

function isUpdaterEnabled(): boolean {
    return app.isPackaged || process.env['UPDATER_ENABLED'] === '1';
}

function getWindow(): BrowserWindow | null {
    if (mainWindow && !mainWindow.isDestroyed()) {
        return mainWindow;
    }

    mainWindow = BrowserWindow.getAllWindows()[0] ?? null;
    return mainWindow;
}

const switchStatusController = createSwitchStatusController({
    getCurrentChannel: () => currentChannel,
    getWindow,
});

function toUpdaterChannel(channel: UpdateChannel): 'latest' | 'beta' | 'alpha' {
    if (channel === 'stable') return 'latest';
    return channel;
}

function applyChannel(channel: UpdateChannel): void {
    currentChannel = channel;
    autoUpdater.channel = toUpdaterChannel(channel);
    autoUpdater.allowPrerelease = channel !== 'stable';
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

export function resolvePersistedUpdateChannel(): UpdateChannel {
    return loadPersistedChannel().channel;
}

export function getCurrentChannel(): UpdateChannel {
    return currentChannel;
}

export function getSwitchStatusSnapshot(): SwitchStatusPayload {
    return switchStatusController.getSnapshot();
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
    switchStatusController.update({
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
    switchStatusController.update({
        phase: 'error',
        percent: null,
        message: 'Failed to check for updates in the selected channel.',
        canInteract: true,
    });
    switchStatusController.scheduleReset(1200);

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

    switchStatusController.update({
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
        switchStatusController.update({
            phase: 'error',
            channel: currentChannel,
            percent: null,
            message: 'Failed to resolve updates for the selected channel.',
            canInteract: true,
        });
        switchStatusController.scheduleReset(1200);

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
    startSwitchFlow({
        channel,
        feedConfigured: true,
        setActiveUpdateFlow: (flow) => {
            activeUpdateFlow = flow;
        },
        updateSwitchStatus: switchStatusController.update,
        scheduleStatusReset: switchStatusController.scheduleReset,
        checkForUpdatesForSelectedChannel,
        getWindow,
    });

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
    switchStatusController.setIdle();

    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    registerUpdaterEvents({
        getCurrentChannel: () => currentChannel,
        getWindow,
        getActiveUpdateFlow: () => activeUpdateFlow,
        setActiveUpdateFlow: (flow) => {
            activeUpdateFlow = flow;
        },
        getManualCheckRequested: () => manualCheckRequested,
        setManualCheckRequested: (requested) => {
            manualCheckRequested = requested;
        },
        updateSwitchStatus: switchStatusController.update,
        scheduleStatusReset: switchStatusController.scheduleReset,
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
