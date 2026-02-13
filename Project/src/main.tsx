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

function waitForFirstPaint(): Promise<void> {
    return new Promise((resolve) => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                resolve();
            });
        });
    });
}

if (rootElement) {
    createRoot(rootElement).render(
        <Providers>
            <StrictMode>
                <RouterProvider router={router} />
            </StrictMode>
            {/* Keep DevTools outside StrictMode to avoid dev-only WS close noise from double-mount. */}
            {isDev && <DevTools router={router} />}
        </Providers>
    );

    // Signal main after React has had a chance to paint the first frame.
    void waitForFirstPaint()
        .then(() => trpcClient.system.signalReady.mutate())
        .catch((error: unknown) => {
            console.warn('[window] Failed to send ready signal:', error);
        });
}
