import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ipcLink } from 'electron-trpc-experimental/renderer';
import { useEffect } from 'react';

import { useRuntimeEventStreamStore } from '@/web/lib/runtime/eventStream';
import { trpcClient as runtimeClient } from '@/web/lib/trpcClient';
import { useWindowStateStreamStore } from '@/web/lib/window/stateStream';
import { trpc } from '@/web/trpc/client';

import type { RuntimeEventRecordV1 } from '@/app/backend/persistence/types';
import type { WindowStateEvent } from '@/app/backend/trpc/routers/system/windowControls';

import type { ReactNode } from 'react';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60,
            retry: 1,
        },
    },
});

const trpcClient = trpc.createClient({
    links: [ipcLink()],
});

interface TRPCProviderProps {
    children: ReactNode;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isRuntimeEventRecord(value: unknown): value is RuntimeEventRecordV1 {
    if (!isRecord(value) || !isRecord(value['payload'])) {
        return false;
    }

    return (
        typeof value['sequence'] === 'number' &&
        typeof value['eventId'] === 'string' &&
        typeof value['entityType'] === 'string' &&
        typeof value['entityId'] === 'string' &&
        typeof value['eventType'] === 'string' &&
        typeof value['createdAt'] === 'string'
    );
}

function isWindowStateEvent(value: unknown): value is WindowStateEvent {
    if (!isRecord(value) || !isRecord(value['state'])) {
        return false;
    }

    const state = value['state'];
    return (
        typeof value['sequence'] === 'number' &&
        typeof state['isMaximized'] === 'boolean' &&
        typeof state['isFullScreen'] === 'boolean' &&
        typeof state['canMaximize'] === 'boolean' &&
        typeof state['canMinimize'] === 'boolean' &&
        typeof state['platform'] === 'string'
    );
}

function RuntimeEventStreamBootstrap(): ReactNode {
    const setConnecting = useRuntimeEventStreamStore((state) => state.setConnecting);
    const setError = useRuntimeEventStreamStore((state) => state.setError);
    const pushEvent = useRuntimeEventStreamStore((state) => state.pushEvent);

    useEffect(() => {
        setConnecting();
        const { lastSequence } = useRuntimeEventStreamStore.getState();

        const subscription = runtimeClient.runtime.subscribeEvents.subscribe(
            lastSequence > 0 ? { afterSequence: lastSequence } : {},
            {
                onData: (event) => {
                    if (isRuntimeEventRecord(event)) {
                        pushEvent(event);
                        return;
                    }

                    setError('Received invalid runtime event payload.');
                },
                onError: (error) => {
                    const message = error instanceof Error ? error.message : String(error);
                    setError(message);
                },
            }
        );

        return () => {
            subscription.unsubscribe();
        };
    }, [setConnecting, setError, pushEvent]);

    return null;
}

function WindowStateStreamBootstrap(): ReactNode {
    const setConnecting = useWindowStateStreamStore((state) => state.setConnecting);
    const setError = useWindowStateStreamStore((state) => state.setError);
    const pushEvent = useWindowStateStreamStore((state) => state.pushEvent);

    useEffect(() => {
        setConnecting();
        const { lastSequence } = useWindowStateStreamStore.getState();

        const subscription = runtimeClient.system.subscribeWindowState.subscribe(
            lastSequence > 0 ? { afterSequence: lastSequence } : {},
            {
                onData: (event) => {
                    if (isWindowStateEvent(event)) {
                        pushEvent(event);
                        return;
                    }

                    setError('Received invalid window state payload.');
                },
                onError: (error) => {
                    const message = error instanceof Error ? error.message : String(error);
                    setError(message);
                },
            }
        );

        return () => {
            subscription.unsubscribe();
        };
    }, [setConnecting, setError, pushEvent]);

    return null;
}

export function TRPCProvider({ children }: TRPCProviderProps): ReactNode {
    return (
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
            <QueryClientProvider client={queryClient}>
                <RuntimeEventStreamBootstrap />
                <WindowStateStreamBootstrap />
                {children}
            </QueryClientProvider>
        </trpc.Provider>
    );
}
