import { describe, expect, it } from 'vitest';

import { getNextSettingsSection } from '@/web/components/settings/settingsSheetNavigation';

describe('settingsSheetNavigation', () => {
    it('moves down through vertical settings tabs', () => {
        expect(
            getNextSettingsSection({
                currentSection: 'providers',
                key: 'ArrowDown',
            })
        ).toBe('profiles');
    });

    it('wraps upward and supports home/end keys', () => {
        expect(
            getNextSettingsSection({
                currentSection: 'providers',
                key: 'ArrowUp',
            })
        ).toBe('agents');
        expect(
            getNextSettingsSection({
                currentSection: 'context',
                key: 'Home',
            })
        ).toBe('providers');
        expect(
            getNextSettingsSection({
                currentSection: 'providers',
                key: 'End',
            })
        ).toBe('agents');
    });

    it('ignores unrelated keys', () => {
        expect(
            getNextSettingsSection({
                currentSection: 'providers',
                key: 'Enter',
            })
        ).toBeUndefined();
    });
});
