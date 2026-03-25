import { QueryClient } from '@tanstack/react-query';
import { createTRPCQueryUtils } from '@trpc/react-query';

import { trpcClient } from '@/web/lib/trpcClient';

export { trpcClient };

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60,
            retry: 1,
        },
    },
});

export const trpcQueryUtils = createTRPCQueryUtils({
    client: trpcClient,
    queryClient,
});
