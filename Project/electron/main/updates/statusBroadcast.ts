import type { BrowserWindow } from 'electron';

export type UpdateChannel = 'stable' | 'beta' | 'alpha';

export type SwitchStatusPhase = 'idle' | 'warning' | 'checking' | 'downloading' | 'downloaded' | 'no_update' | 'error';

export interface SwitchStatusPayload {
    phase: SwitchStatusPhase;
    channel: UpdateChannel;
    percent: number | null;
    message: string;
    canInteract: boolean;
}

interface SwitchStatusControllerInput {
    getCurrentChannel: () => UpdateChannel;
    getWindow: () => BrowserWindow | null;
}

interface SwitchStatusController {
    getSnapshot: () => SwitchStatusPayload;
    update: (patch: Partial<SwitchStatusPayload>) => void;
    scheduleReset: (delayMs?: number) => void;
    setIdle: () => void;
    dispose: () => void;
}

export function createInitialSwitchStatus(channel: UpdateChannel): SwitchStatusPayload {
    return {
        phase: 'idle',
        channel,
        percent: null,
        message: '',
        canInteract: true,
    };
}

export function createSwitchStatusController(input: SwitchStatusControllerInput): SwitchStatusController {
    let resetStatusTimer: NodeJS.Timeout | null = null;
    let switchStatus = createInitialSwitchStatus(input.getCurrentChannel());

    const setIdle = (): void => {
        switchStatus = createInitialSwitchStatus(input.getCurrentChannel());
        input.getWindow()?.webContents.send('updater:switch-status', switchStatus);
    };

    const update = (patch: Partial<SwitchStatusPayload>): void => {
        if (resetStatusTimer) {
            clearTimeout(resetStatusTimer);
            resetStatusTimer = null;
        }

        switchStatus = {
            ...switchStatus,
            channel: input.getCurrentChannel(),
            ...patch,
        };
        input.getWindow()?.webContents.send('updater:switch-status', switchStatus);
    };

    const scheduleReset = (delayMs = 300): void => {
        if (resetStatusTimer) {
            clearTimeout(resetStatusTimer);
        }

        resetStatusTimer = setTimeout(() => {
            setIdle();
        }, delayMs);
    };

    return {
        getSnapshot: () => ({ ...switchStatus }),
        update,
        scheduleReset,
        setIdle,
        dispose: () => {
            if (resetStatusTimer) {
                clearTimeout(resetStatusTimer);
                resetStatusTimer = null;
            }
        },
    };
}
