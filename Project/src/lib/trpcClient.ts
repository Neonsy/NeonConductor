import { ipcLink } from 'electron-trpc-experimental/renderer';

import { trpc } from '@/web/trpc/client';

// Shared renderer tRPC client. Multiple client instances can collide on IPC request ids.
export const trpcClient = trpc.createClient({
    links: [ipcLink()],
});
