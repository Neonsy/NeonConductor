import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import DevTools from '@/web/components/utils/devtools';
import Providers from '@/web/lib/providers';
import { trpcClient } from '@/web/lib/trpcClient';
import { router } from '@/web/router';
import '@/web/styles/index.css';

const isDev = import.meta.env.DEV;

const rootElement = document.getElementById('root');

if (rootElement) {
    createRoot(rootElement).render(
        <StrictMode>
            <Providers>
                <RouterProvider router={router} />
                {isDev && <DevTools router={router} />}
            </Providers>
        </StrictMode>
    );

    // Signal to main process that React has rendered
    // This ensures the window only appears after content is ready, preventing blank flash.
    // The main process waits for this signal before showing/maximizing the window.
    void trpcClient.system.signalReady.mutate();
}
