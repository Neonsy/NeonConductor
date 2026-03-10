/// <reference types="vite/client" />

import type { BootStatusSnapshot } from '@/app/shared/splashContract';

declare module '*.wasm?url' {
    const wasmAssetUrl: string;
    export default wasmAssetUrl;
}

declare global {
    interface Window {
        neonSplash?: {
            onStatusChange(listener: (status: BootStatusSnapshot) => void): () => void;
        };
    }
}

export {};
