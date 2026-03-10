import { QueryClient } from '@tanstack/react-query';
import { createTRPCQueryUtils } from '@trpc/react-query';
import { ipcLink } from 'electron-trpc-experimental/renderer';

import { trpc } from '@/web/trpc/client';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60,
            retry: 1,
        },
    },
});

export const trpcClient = trpc.createClient({
    links: [ipcLink()],
});

export const trpcQueryUtils = createTRPCQueryUtils({
    client: trpcClient,
    queryClient,
});
