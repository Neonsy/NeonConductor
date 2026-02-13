import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    plugins: [tsconfigPaths()],
    test: {
        environment: 'node',
        passWithNoTests: true,
        include: ['electron/**/*.test.ts', 'src/**/*.test.ts'],
    },
});
