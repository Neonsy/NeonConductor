import { describe, expect, it } from 'vitest';

import {
    getActivateProfileStatusMessage,
    getDeleteProfileStatusMessage,
    getDuplicateProfileStatusMessage,
    getRenameProfileStatusMessage,
} from '@/web/components/settings/profileSettings/messages';

describe('profileSettings messages', () => {
    it('preserves lifecycle success and failure copy', () => {
        expect(getRenameProfileStatusMessage({ updated: true, profileName: 'Local Default' })).toBe(
            'Renamed profile to "Local Default".'
        );
        expect(getDuplicateProfileStatusMessage({ duplicated: false, profileName: undefined })).toBe(
            'Duplicate failed: profile not found.'
        );
        expect(getActivateProfileStatusMessage({ updated: false, profileName: undefined })).toBe(
            'Set active failed: profile not found.'
        );
        expect(getDeleteProfileStatusMessage({ deleted: false, reason: 'last_profile' })).toBe(
            'Cannot delete the last remaining profile.'
        );
    });
});
