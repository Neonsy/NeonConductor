import { describe, expect, it } from 'vitest';

import { resolveSelectedProfileId } from '@/web/components/settings/profileSettings/selection';

describe('resolveSelectedProfileId', () => {
    it('prefers the active profile when the current selection is invalid', () => {
        expect(
            resolveSelectedProfileId(
                [
                    {
                        id: 'profile_a',
                        name: 'A',
                        isActive: false,
                        createdAt: '2026-03-06T10:00:00.000Z',
                        updatedAt: '2026-03-06T10:00:00.000Z',
                    },
                    {
                        id: 'profile_b',
                        name: 'B',
                        isActive: true,
                        createdAt: '2026-03-06T10:00:00.000Z',
                        updatedAt: '2026-03-06T10:00:00.000Z',
                    },
                ],
                'missing',
                'profile_b'
            )
        ).toBe('profile_b');
    });
});
