import { log } from 'evlog';
import { useEffect } from 'react';

import { sendRendererReadySignal } from '@/web/components/runtime/rendererReadySignal';

const isDev = import.meta.env.DEV;

export function useRendererBootReadySignal(isBootReady: boolean): void {
    useEffect(() => {
        if (!isBootReady) {
            return;
        }

        void sendRendererReadySignal().catch((error: unknown) => {
            if (!isDev) {
                return;
            }

            log.warn({
                tag: 'window',
                message: 'Failed to send ready signal.',
                ...(error instanceof Error ? { error: error.message } : { error: String(error) }),
            });
        });
    }, [isBootReady]);
}
