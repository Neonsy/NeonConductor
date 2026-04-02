import { log } from 'evlog';
import { useEffect, useSyncExternalStore } from 'react';

import {
    ensureRendererReadySignal,
    getRendererReadySignalSnapshot,
    subscribeRendererReadySignal,
    type RendererReadySignalSnapshot,
} from '@/web/components/runtime/rendererReadySignal';

import { launchBackgroundTask } from '@/shared/async/launchBackgroundTask';

const isDev = import.meta.env.DEV;

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

export function useRendererBootReadySignal(isReadyToSignal: boolean): RendererReadySignalSnapshot {
    const readySignalSnapshot = useSyncExternalStore(
        subscribeRendererReadySignal,
        getRendererReadySignalSnapshot,
        getRendererReadySignalSnapshot
    );

    useEffect(() => {
        if (!isReadyToSignal || readySignalSnapshot.readySignalState !== 'idle') {
            return;
        }

        launchBackgroundTask(
            async () => {
                await ensureRendererReadySignal();
            },
            (error: unknown) => {
                if (!isDev) {
                    return;
                }

                log.warn({
                    tag: 'window.boot',
                    message: 'Failed to send ready signal.',
                    error: getErrorMessage(error),
                });
            }
        );
    }, [isReadyToSignal, readySignalSnapshot.readySignalState]);

    return readySignalSnapshot;
}
