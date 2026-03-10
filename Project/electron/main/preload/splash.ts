import { contextBridge, ipcRenderer } from 'electron';

import {
    INITIAL_BOOT_STATUS_SNAPSHOT,
    isBootStatusSnapshot,
    SPLASH_BOOT_STATUS_CHANNEL,
    type BootStatusSnapshot,
} from '@/app/shared/splashContract';

type BootStatusListener = (status: BootStatusSnapshot) => void;

const splashStatusListeners = new Set<BootStatusListener>();
let currentBootStatus: BootStatusSnapshot = INITIAL_BOOT_STATUS_SNAPSHOT;

ipcRenderer.on(SPLASH_BOOT_STATUS_CHANNEL, (_event, nextStatus: unknown) => {
    if (!isBootStatusSnapshot(nextStatus)) {
        return;
    }

    currentBootStatus = nextStatus;

    for (const listener of splashStatusListeners) {
        listener(currentBootStatus);
    }
});

contextBridge.exposeInMainWorld('neonSplash', {
    onStatusChange(listener: BootStatusListener): () => void {
        splashStatusListeners.add(listener);
        listener(currentBootStatus);

        return () => {
            splashStatusListeners.delete(listener);
        };
    },
});
