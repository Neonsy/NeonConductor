import Store from 'electron-store';

import { appLog } from '@/app/main/logging';
import type { UpdateChannel } from '@/app/main/updates/statusBroadcast';

export interface PersistedChannelState {
    channel: UpdateChannel;
    exists: boolean;
}

export const DEFAULT_CHANNEL: UpdateChannel = 'stable';

let channelStore: Store<{ channel?: UpdateChannel }> | null = null;

export function isUpdateChannel(value: unknown): value is UpdateChannel {
    return value === 'stable' || value === 'beta' || value === 'alpha';
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

export function loadPersistedChannel(): PersistedChannelState {
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

export function persistChannel(channel: UpdateChannel): void {
    getChannelStore().set('channel', channel);
}

export function resetChannelStoreForTests(): void {
    channelStore = null;
}
