import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/web/components/settings/kiloSettingsView', () => ({
    KiloSettingsView: () => <div>kilo section</div>,
}));

vi.mock('@/web/components/settings/modesSettings/view', () => ({
    ModesSettingsView: () => <div>modes section</div>,
}));

vi.mock('@/web/components/settings/providerSettingsView', () => ({
    ProviderSettingsView: () => <div>provider section</div>,
}));

vi.mock('@/web/components/settings/profileSettingsView', () => ({
    ProfileSettingsView: () => <div>profile section</div>,
}));

vi.mock('@/web/components/settings/contextSettingsView', () => ({
    ContextSettingsView: () => <div>context section</div>,
}));

vi.mock('@/web/components/settings/registrySettingsView', () => ({
    RegistrySettingsView: () => <div>registry section</div>,
}));

vi.mock('@/web/components/settings/appSettings/view', () => ({
    AppSettingsView: () => <div>app section</div>,
}));

import {
    getGroupedSettingsPrimarySections,
    SettingsSectionContent,
} from '@/web/components/settings/settingsSectionContent';

describe('settings section content', () => {
    it('keeps Kilo-first grouping in one shared helper', () => {
        const groupedSections = getGroupedSettingsPrimarySections();

        expect(groupedSections.kiloSections.map((section) => section.id)).toEqual(['kilo']);
        expect(groupedSections.generalSections.map((section) => section.id)).toContain('providers');
    });

    it('renders the selected section from the shared mapping boundary', () => {
        const html = renderToStaticMarkup(
            <SettingsSectionContent
                profileId='profile_default'
                selection={{ section: 'providers', subsection: 'kilo' }}
                onSelectionChange={vi.fn()}
                onProfileActivated={vi.fn()}
            />
        );

        expect(html).toContain('provider section');
    });
});
