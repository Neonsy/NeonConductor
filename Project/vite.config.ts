import tailwindcss from '@tailwindcss/vite';
import { devtools } from '@tanstack/devtools-vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type LibraryFormats } from 'vite';
import electron from 'vite-plugin-electron';
import tsconfigPaths from 'vite-tsconfig-paths';

import { resolveElectronChildEnv } from './electron/main/runtime/electronChildEnv';

const sandboxedPreloadFormats: LibraryFormats[] = ['cjs'];

function buildPreloadOptions(input: string, outputFileName: string) {
    return {
        entry: input,
        onstart({ reload }: { reload: () => void }) {
            reload();
        },
        vite: {
            plugins: [tsconfigPaths()],
            build: {
                lib: {
                    entry: input,
                    formats: sandboxedPreloadFormats,
                    fileName: () => `${outputFileName}.js`,
                },
                rollupOptions: {
                    input,
                    output: {
                        format: 'cjs' as const,
                        inlineDynamicImports: true,
                        entryFileNames: `${outputFileName}.js`,
                        chunkFileNames: `${outputFileName}.js`,
                        assetFileNames: '[name].[ext]',
                    },
                },
            },
        },
    };
}

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        devtools(),
        tsconfigPaths(),
        tanstackRouter({
            target: 'react',
            autoCodeSplitting: true,
        }),

        react({
            babel: {
                plugins: [['babel-plugin-react-compiler']],
            },
        }),
        tailwindcss(),
        ...electron([
            {
                entry: 'electron/main/index.ts',
                onstart({ startup }) {
                    void startup(['.', '--no-sandbox'], {
                        env: resolveElectronChildEnv(),
                    });
                },
                vite: {
                    plugins: [tsconfigPaths()],
                },
            },
            buildPreloadOptions('electron/main/preload/index.ts', 'mainWindow'),
            buildPreloadOptions('electron/main/preload/splash.ts', 'splashWindow'),
        ]),
    ],
});
