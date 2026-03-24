import { skipToken } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { buildWorkspaceModeQueryInput } from '@/web/components/runtime/useWorkspaceModeState';
import { buildWorkspaceRootsQueryInput } from '@/web/components/runtime/workspaceSurfaceController';

describe('workspace query input builders', () => {
    it('returns skipToken for workspace roots until a real profile id exists', () => {
        expect(buildWorkspaceRootsQueryInput(undefined)).toBe(skipToken);
        expect(buildWorkspaceRootsQueryInput('profile_default')).toEqual({
            profileId: 'profile_default',
        });
    });

    it('returns skipToken for workspace mode queries until a real profile id exists', () => {
        expect(
            buildWorkspaceModeQueryInput({
                resolvedProfileId: undefined,
                topLevelTab: 'chat',
            })
        ).toBe(skipToken);

        expect(
            buildWorkspaceModeQueryInput({
                resolvedProfileId: 'profile_default',
                topLevelTab: 'agent',
                workspaceFingerprint: 'ws_real',
            })
        ).toEqual({
            profileId: 'profile_default',
            topLevelTab: 'agent',
            workspaceFingerprint: 'ws_real',
        });
    });
});
