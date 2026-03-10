import { describe, expect, it } from 'vitest';

import {
    INITIAL_CONVERSATION_SHELL_BOOT_CHROME_READINESS,
    isWorkspaceBootReady,
} from '@/web/components/runtime/bootReadiness';

describe('bootReadiness', () => {
    it('stays false until the full boot contract is satisfied', () => {
        expect(
            isWorkspaceBootReady({
                ...INITIAL_CONVERSATION_SHELL_BOOT_CHROME_READINESS,
                hasResolvedProfile: true,
                hasResolvedInitialMode: true,
                hasInteractiveShell: true,
            })
        ).toBe(false);
    });

    it('returns true once profile, mode, and all shell chrome queries are settled', () => {
        expect(
            isWorkspaceBootReady({
                shellBootstrapSettled: true,
                bucketListSettled: true,
                tagListSettled: true,
                threadListSettled: true,
                sessionListSettled: true,
                hasResolvedProfile: true,
                hasResolvedInitialMode: true,
                hasInteractiveShell: true,
            })
        ).toBe(true);
    });
});
