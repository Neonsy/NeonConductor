import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ipcLink } from 'electron-trpc-experimental/renderer';

import { trpc } from '@/web/trpc/client';

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

export function TRPCProvider({ children }: TRPCProviderProps): ReactNode {
    return (
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </trpc.Provider>
    );
}
