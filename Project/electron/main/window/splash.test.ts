import { describe, expect, it } from 'vitest';

import { buildSplashHtml, resolveSplashAssetPath } from '@/app/main/window/splash';

describe('splash window', () => {
    it('resolves the mascot from the project app path during development', () => {
        expect(
            resolveSplashAssetPath({
                appPath: 'C:\\repo\\Project',
                isPackaged: false,
            })
        ).toBe('C:\\repo\\Project\\src\\assets\\appicon.png');
    });

    it('resolves the packaged mascot from extra resources', () => {
        expect(
            resolveSplashAssetPath({
                appPath: 'ignored',
                isPackaged: true,
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
        expect(html).toContain('window.__setSplashPhase');
        expect(html).toContain('id="splash-subtitle"');
    });
});
