import { describe, expect, it } from 'vitest';

import {
    INITIAL_CONVERSATION_SHELL_BOOT_CHROME_READINESS,
    isWorkspaceBootReady,
} from '@/web/components/runtime/bootReadiness';

describe('bootReadiness', () => {
    it('stays false until profile, mode, and shell bootstrap are ready', () => {
        expect(
            isWorkspaceBootReady({
                ...INITIAL_CONVERSATION_SHELL_BOOT_CHROME_READINESS,
                hasResolvedProfile: true,
                hasResolvedInitialMode: true,
                hasInteractiveShell: true,
            })
        ).toBe(false);
    });

    it('returns true once the shell-level boot contract is satisfied', () => {
        expect(
            isWorkspaceBootReady({
                shellBootstrapSettled: true,
                hasResolvedProfile: true,
                hasResolvedInitialMode: true,
                hasInteractiveShell: true,
            })
        ).toBe(true);
    });
});
