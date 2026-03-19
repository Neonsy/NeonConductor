import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/web/components/settings/providersWorkspace/view', () => ({
    ProvidersWorkspaceView: () => <div>providers view</div>,
}));

vi.mock('@/web/components/settings/profileSettingsView', () => ({
    ProfileSettingsView: () => <div>profiles view</div>,
}));

vi.mock('@/web/components/settings/contextSettingsView', () => ({
    ContextSettingsView: () => <div>context view</div>,
}));

vi.mock('@/web/components/settings/registrySettingsView', () => ({
    RegistrySettingsView: () => <div>skills view</div>,
}));

vi.mock('@/web/components/settings/appSettings/view', () => ({
    AppSettingsView: () => <div>app view</div>,
}));

vi.mock('@/web/lib/privacy/privacyContext', () => ({
    usePrivacyMode: () => ({ enabled: false }),
}));

import { SettingsWorkspace } from '@/web/components/settings/settingsWorkspace';

describe('settings workspace', () => {
    it('keeps the return affordance inside the settings surface', () => {
        const html = renderToStaticMarkup(
            <SettingsWorkspace
                profileId='profile_default'
                onProfileActivated={vi.fn()}
                onReturnToSessions={vi.fn()}
            />
        );

        expect(html).toContain('Back to sessions');
        expect(html).toContain('Settings');
        expect(html).toContain('Providers &amp; Models');
        expect(html).toContain('Choose an area to configure.');
    });

    it('keeps the settings body overflow-safe inside the workspace surface', () => {
        const html = renderToStaticMarkup(
            <SettingsWorkspace
                profileId='profile_default'
                onProfileActivated={vi.fn()}
                onReturnToSessions={vi.fn()}
            />
        );

        expect(html).toContain('min-w-0');
        expect(html).toContain('overflow-hidden');
        expect(html).toContain('providers view');
    });
});
