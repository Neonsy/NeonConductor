/**
 * Preload script - runs in isolated context before renderer loads.
 * Exposes only the tRPC IPC bridge to the renderer (minimal attack surface).
 */

import { exposeElectronTRPC } from 'electron-trpc-experimental/preload';

// 'loaded' fires after preload executes but before renderer scripts run
process.once('loaded', () => {
    exposeElectronTRPC();
});
