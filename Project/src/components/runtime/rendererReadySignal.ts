import { trpcClient } from '@/web/lib/trpcClient';

let rendererReadySignalState: 'idle' | 'pending' | 'sent' = 'idle';

export async function sendRendererReadySignal(): Promise<void> {
    if (rendererReadySignalState === 'pending' || rendererReadySignalState === 'sent') {
        return;
    }

    rendererReadySignalState = 'pending';

    try {
        await trpcClient.system.signalReady.mutate();
        rendererReadySignalState = 'sent';
    } catch (error) {
        rendererReadySignalState = 'idle';
        throw error;
    }
}

export function resetRendererReadySignalForTests(): void {
    rendererReadySignalState = 'idle';
}
