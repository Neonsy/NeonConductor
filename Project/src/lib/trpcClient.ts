import { createTRPCProxyClient } from '@trpc/client';
import { ipcLink } from 'electron-trpc-experimental/renderer';

import type { AppRouter } from '@/app/backend/trpc/router';

// Vanilla tRPC client for use outside React components (e.g., in main.tsx)
export const trpcClient = createTRPCProxyClient<AppRouter>({ links: [ipcLink()] });
