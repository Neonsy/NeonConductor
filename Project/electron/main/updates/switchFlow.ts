import { dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import { err, ok, type Result } from 'neverthrow';

import { appLog } from '@/app/main/logging';
import type { UpdaterOperationError } from '@/app/main/updates/feedControl';
import type { SwitchStatusPayload, UpdateChannel } from '@/app/main/updates/statusBroadcast';

import type { BrowserWindow } from 'electron';

export interface ActiveUpdateFlow {
    source: 'switch' | 'manual';
    channel: UpdateChannel;
}

interface StartSwitchFlowInput {
    channel: UpdateChannel;
    feedConfigured?: boolean;
    setActiveUpdateFlow: (flow: ActiveUpdateFlow | null) => void;
    updateSwitchStatus: (patch: Partial<SwitchStatusPayload>) => void;
    scheduleStatusReset: (delayMs?: number) => void;
    checkForUpdatesForSelectedChannel: (
        channel: UpdateChannel,
        options?: { forceRefresh?: boolean; applyResolvedChannel?: boolean }
    ) => Promise<Result<void, UpdaterOperationError>>;
    getWindow: () => BrowserWindow | null;
}

export function startSwitchFlow(input: StartSwitchFlowInput): void {
    input.setActiveUpdateFlow({
        source: 'switch',
        channel: input.channel,
    });
    input.updateSwitchStatus({
        phase: 'checking',
        channel: input.channel,
        percent: 0,
        message: 'Checking for updates in the selected channel...',
        canInteract: false,
    });

    const checkPromise: Promise<Result<void, UpdaterOperationError>> = input.feedConfigured
        ? autoUpdater
              .checkForUpdates()
              .then(() => ok(undefined))
              .catch(() =>
                  err({
                      code: 'check_failed',
                      message: 'Failed to check for updates in the selected channel.',
                  })
              )
        : input.checkForUpdatesForSelectedChannel(input.channel, {
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
        input.setActiveUpdateFlow(null);
        input.updateSwitchStatus({
            phase: 'error',
            percent: null,
            message: 'Failed to check for updates in the selected channel.',
            canInteract: true,
        });
        input.scheduleStatusReset(1200);

        const window = input.getWindow();
        if (window) {
            void dialog.showMessageBox(window, {
                type: 'error',
                title: 'Channel Switch Failed',
                message: 'Failed to check for updates for the selected channel.',
            });
        }
    });
}
