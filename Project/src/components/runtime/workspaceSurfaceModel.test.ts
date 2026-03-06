import { describe, expect, it } from 'vitest';

import {
    resolveActiveWorkspaceProfileId,
    resolveWorkspaceActiveModeKey,
} from '@/web/components/runtime/workspaceSurfaceModel';

describe('workspaceSurfaceModel', () => {
    it('prefers a valid local selection, then active server profile, then flagged active', () => {
        expect(
            resolveActiveWorkspaceProfileId({
                activeProfileId: 'profile_a',
                serverActiveProfileId: 'profile_b',
                profiles: [
                    { id: 'profile_a', isActive: false },
                    { id: 'profile_b', isActive: true },
                ],
            })
        ).toBe('profile_a');

        expect(
            resolveActiveWorkspaceProfileId({
                activeProfileId: 'missing',
                serverActiveProfileId: 'profile_b',
                profiles: [
                    { id: 'profile_a', isActive: false },
                    { id: 'profile_b', isActive: true },
                ],
            })
        ).toBe('profile_b');
    });

    it('falls back to the tab default mode when no active mode is loaded', () => {
        expect(resolveWorkspaceActiveModeKey('orchestrator', undefined)).toBe('plan');
        expect(resolveWorkspaceActiveModeKey('agent', 'debug')).toBe('debug');
    });
});
