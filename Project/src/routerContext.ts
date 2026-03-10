import type { queryClient, trpcQueryUtils } from '@/web/lib/providers/trpcCore';

export interface AppRouterContext {
    queryClient: typeof queryClient;
    trpcUtils: typeof trpcQueryUtils;
}
