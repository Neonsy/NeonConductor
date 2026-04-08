import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function evaluateElectronBuilderConfig(source: string): Record<string, unknown> {
    return Function(`return (${source});`)() as Record<string, unknown>;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('vendored Node packaging', () => {
    it('wires platform packaging scripts through vendored Node fetch commands', () => {
        const packageJson = JSON.parse(
            readFileSync(path.resolve(__dirname, '../package.json'), 'utf8')
        ) as {
            scripts: Record<string, string>;
        };

        expect(packageJson.scripts['build:win']).toContain('pnpm run vendor:node:win &&');
        expect(packageJson.scripts['build:mac']).toContain('pnpm run vendor:node:mac &&');
        expect(packageJson.scripts['build:mac:arm64']).toContain('pnpm run vendor:node:mac:arm64 &&');
        expect(packageJson.scripts['build:mac:x64']).toContain('pnpm run vendor:node:mac:x64 &&');
        expect(packageJson.scripts['build:linux']).toContain('pnpm run vendor:node:linux &&');
    });

    it('packages the platform-specific vendored Node executable into Electron resources', () => {
        const electronBuilderConfig = evaluateElectronBuilderConfig(
            readFileSync(path.resolve(__dirname, '../electron-builder.json5'), 'utf8')
        );

        expect(electronBuilderConfig['win']).toMatchObject({
            extraResources: expect.arrayContaining([
                {
                    from: 'vendor/node/win32-${arch}/node.exe',
                    to: 'vendor/node/win32-${arch}/node.exe',
                },
            ]),
        });
        expect(electronBuilderConfig['mac']).toMatchObject({
            extraResources: expect.arrayContaining([
                {
                    from: 'vendor/node/darwin-${arch}/node',
                    to: 'vendor/node/darwin-${arch}/node',
                },
            ]),
        });
        expect(electronBuilderConfig['linux']).toMatchObject({
            extraResources: expect.arrayContaining([
                {
                    from: 'vendor/node/linux-${arch}/node',
                    to: 'vendor/node/linux-${arch}/node',
                },
            ]),
        });
    });
});
