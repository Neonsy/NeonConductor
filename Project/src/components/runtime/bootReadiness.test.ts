import { describe, expect, it } from 'vitest';

import {
    INITIAL_CONVERSATION_SHELL_BOOT_CHROME_READINESS,
    areWorkspaceBootPrerequisitesReady,
    getWorkspaceBootDiagnostics,
} from '@/web/components/runtime/bootReadiness';

describe('bootReadiness', () => {
    it('keeps boot prerequisites blocked until profile, mode, and shell bootstrap are ready', () => {
        expect(
            areWorkspaceBootPrerequisitesReady({
                ...INITIAL_CONVERSATION_SHELL_BOOT_CHROME_READINESS,
                hasResolvedProfile: true,
                profilePending: false,
                hasProfiles: true,
                hasResolvedInitialMode: true,
                modePending: false,
                hasInteractiveShell: true,
            })
        ).toBe(false);
    });

    it('marks prerequisites ready once the boot-critical queries have resolved successfully', () => {
        expect(
            areWorkspaceBootPrerequisitesReady({
                shellBootstrapSettled: true,
                hasResolvedProfile: true,
                profilePending: false,
                hasProfiles: true,
                hasResolvedInitialMode: true,
                modePending: false,
                hasInteractiveShell: true,
            })
        ).toBe(true);
    });

    it('reports profile resolution as the first blocking prerequisite', () => {
        const diagnostics = getWorkspaceBootDiagnostics({
            shellBootstrapSettled: false,
            hasResolvedProfile: false,
            profilePending: true,
            hasProfiles: true,
            hasResolvedInitialMode: false,
            modePending: false,
            hasInteractiveShell: false,
            readySignalState: 'idle',
            elapsedMs: 250,
        });

        expect(diagnostics.status.stage).toBe('profile_resolving');
        expect(diagnostics.status.blockingPrerequisite).toBe('resolved_profile');
        expect(diagnostics.hasCriticalError).toBe(false);
    });

    it('reports query failures as critical boot blockers', () => {
        const diagnostics = getWorkspaceBootDiagnostics({
            shellBootstrapSettled: false,
            shellBootstrapErrorMessage: 'bootstrap query failed',
            hasResolvedProfile: true,
            profilePending: false,
            hasProfiles: true,
            hasResolvedInitialMode: true,
            modePending: false,
            hasInteractiveShell: false,
            readySignalState: 'idle',
            elapsedMs: 500,
        });

        expect(diagnostics.status.stage).toBe('shell_bootstrap_loading');
        expect(diagnostics.status.isStuck).toBe(true);
        expect(diagnostics.hasCriticalError).toBe(true);
        expect(diagnostics.status.detail).toContain('bootstrap query failed');
    });

    it('reports the renderer ready handoff as the last blocker before show', () => {
        const diagnostics = getWorkspaceBootDiagnostics({
            shellBootstrapSettled: true,
            hasResolvedProfile: true,
            profilePending: false,
            hasProfiles: true,
            hasResolvedInitialMode: true,
            modePending: false,
            hasInteractiveShell: true,
            readySignalState: 'idle',
            elapsedMs: 1000,
        });

        expect(diagnostics.isReadyToSignal).toBe(true);
        expect(diagnostics.status.stage).toBe('ready_to_show');
        expect(diagnostics.status.blockingPrerequisite).toBe('renderer_ready_signal');
    });

    it('clears the renderer ready blocker once the handoff has been sent', () => {
        const diagnostics = getWorkspaceBootDiagnostics({
            shellBootstrapSettled: true,
            hasResolvedProfile: true,
            profilePending: false,
            hasProfiles: true,
            hasResolvedInitialMode: true,
            modePending: false,
            hasInteractiveShell: true,
            readySignalState: 'sent',
            elapsedMs: 1000,
        });

        expect(diagnostics.isReadyToSignal).toBe(false);
        expect(diagnostics.status.stage).toBe('ready_to_show');
        expect(diagnostics.status.blockingPrerequisite).toBeNull();
    });

    it('surfaces ready handoff failures as critical boot diagnostics', () => {
        const diagnostics = getWorkspaceBootDiagnostics({
            shellBootstrapSettled: true,
            hasResolvedProfile: true,
            profilePending: false,
            hasProfiles: true,
            hasResolvedInitialMode: true,
            modePending: false,
            hasInteractiveShell: true,
            readySignalState: 'failed',
            readySignalErrorMessage: 'ipc channel closed',
            elapsedMs: 1500,
        });

        expect(diagnostics.isReadyToSignal).toBe(false);
        expect(diagnostics.hasCriticalError).toBe(true);
        expect(diagnostics.status.blockingPrerequisite).toBe('renderer_ready_signal');
        expect(diagnostics.status.detail).toContain('ipc channel closed');
    });
});
