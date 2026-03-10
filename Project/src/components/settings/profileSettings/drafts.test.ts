import { describe, expect, it } from 'vitest';

import { resolveProfileRenameValue } from '@/web/components/settings/profileSettings/drafts';

describe('profile settings drafts', () => {
    it('keeps the keyed rename draft when the selected profile refreshes', () => {
        expect(
            resolveProfileRenameValue({
                selectedProfile: {
                    id: 'profile_default',
                    name: 'Server Name',
                    isActive: true,
                    createdAt: '2026-03-10T10:00:00.000Z',
                    updatedAt: '2026-03-10T10:00:00.000Z',
                },
                renameDraft: {
                    profileId: 'profile_default',
                    value: 'Unsaved Draft',
                },
            })
        ).toBe('Unsaved Draft');
    });

    it('falls back to the selected profile name when no matching draft exists', () => {
        expect(
            resolveProfileRenameValue({
                selectedProfile: {
                    id: 'profile_default',
                    name: 'Canonical Name',
                    isActive: true,
                    createdAt: '2026-03-10T10:00:00.000Z',
                    updatedAt: '2026-03-10T10:00:00.000Z',
                },
                renameDraft: {
                    profileId: 'profile_other',
                    value: 'Other Draft',
                },
            })
        ).toBe('Canonical Name');
    });
});
