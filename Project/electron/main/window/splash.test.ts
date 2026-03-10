import { describe, expect, it } from 'vitest';

import { buildSplashHtml, resolveSplashAssetPath } from '@/app/main/window/splash';

describe('splash window', () => {
    it('resolves the mascot from src/assets during development', () => {
        expect(
            resolveSplashAssetPath({
                isDev: true,
                mainDirname: 'C:\\repo\\Project\\electron\\main',
            })
        ).toBe('C:\\repo\\Project\\src\\assets\\appicon.png');
    });

    it('resolves the packaged mascot from extra resources', () => {
        expect(
            resolveSplashAssetPath({
                isDev: false,
                mainDirname: 'ignored',
                resourcesPath: 'C:\\Program Files\\NeonConductor\\resources',
            })
        ).toBe('C:\\Program Files\\NeonConductor\\resources\\assets\\appicon.png');
    });

    it('updates the splash subtitle when startup is delayed', () => {
        const html = buildSplashHtml({
            imageDataUrl: 'data:image/png;base64,test',
            phase: 'delayed',
        });

        expect(html).toContain('Still starting. Preparing the workspace and runtime.');
        expect(html).toContain('NeonConductor');
    });
});
