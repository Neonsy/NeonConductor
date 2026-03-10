import { createBootStatusSnapshot, type BootStatusSnapshot } from '@/app/shared/splashContract';

export type RendererReadySignalState = 'idle' | 'pending' | 'sent' | 'failed';

export interface ConversationShellBootChromeReadiness {
    shellBootstrapSettled: boolean;
    shellBootstrapErrorMessage?: string;
}

export interface WorkspaceBootPrerequisitesInput extends ConversationShellBootChromeReadiness {
    hasResolvedProfile: boolean;
    profilePending: boolean;
    hasProfiles: boolean;
    profileErrorMessage?: string;
    hasResolvedInitialMode: boolean;
    modePending: boolean;
    modeErrorMessage?: string;
    hasInteractiveShell: boolean;
}

export interface WorkspaceBootDiagnosticsInput extends WorkspaceBootPrerequisitesInput {
    elapsedMs: number;
    readySignalState: RendererReadySignalState;
    readySignalErrorMessage?: string;
}

export interface WorkspaceBootDiagnostics {
    status: BootStatusSnapshot;
    hasCriticalError: boolean;
    isReadyToSignal: boolean;
}

export const INITIAL_CONVERSATION_SHELL_BOOT_CHROME_READINESS: ConversationShellBootChromeReadiness = {
    shellBootstrapSettled: false,
};

function normalizeErrorMessage(value: string | undefined): string | undefined {
    const normalizedValue = value?.trim();
    return normalizedValue ? normalizedValue : undefined;
}

export function areWorkspaceBootPrerequisitesReady(input: WorkspaceBootPrerequisitesInput): boolean {
    return (
        input.hasResolvedProfile &&
        !normalizeErrorMessage(input.profileErrorMessage) &&
        input.hasResolvedInitialMode &&
        !normalizeErrorMessage(input.modeErrorMessage) &&
        input.shellBootstrapSettled &&
        !normalizeErrorMessage(input.shellBootstrapErrorMessage) &&
        input.hasInteractiveShell
    );
}

export function isWorkspaceBootReady(input: WorkspaceBootPrerequisitesInput): boolean {
    return areWorkspaceBootPrerequisitesReady(input);
}

export function getWorkspaceBootDiagnostics(input: WorkspaceBootDiagnosticsInput): WorkspaceBootDiagnostics {
    const profileErrorMessage = normalizeErrorMessage(input.profileErrorMessage);
    if (profileErrorMessage) {
        return {
            status: createBootStatusSnapshot({
                stage: 'profile_resolving',
                source: 'renderer',
                elapsedMs: input.elapsedMs,
                isStuck: true,
                blockingPrerequisite: 'resolved_profile',
                detail: `Profile resolution failed: ${profileErrorMessage}`,
            }),
            hasCriticalError: true,
            isReadyToSignal: false,
        };
    }

    if (!input.hasResolvedProfile) {
        return {
            status: createBootStatusSnapshot({
                stage: 'profile_resolving',
                source: 'renderer',
                elapsedMs: input.elapsedMs,
                blockingPrerequisite: 'resolved_profile',
                detail: input.profilePending
                    ? 'Waiting for the active workspace profile.'
                    : input.hasProfiles
                      ? 'Waiting for the active workspace profile.'
                      : 'No workspace profile is available yet.',
            }),
            hasCriticalError: false,
            isReadyToSignal: false,
        };
    }

    const modeErrorMessage = normalizeErrorMessage(input.modeErrorMessage);
    if (modeErrorMessage) {
        return {
            status: createBootStatusSnapshot({
                stage: 'mode_resolving',
                source: 'renderer',
                elapsedMs: input.elapsedMs,
                isStuck: true,
                blockingPrerequisite: 'initial_mode',
                detail: `Initial mode resolution failed: ${modeErrorMessage}`,
            }),
            hasCriticalError: true,
            isReadyToSignal: false,
        };
    }

    if (!input.hasResolvedInitialMode) {
        return {
            status: createBootStatusSnapshot({
                stage: 'mode_resolving',
                source: 'renderer',
                elapsedMs: input.elapsedMs,
                blockingPrerequisite: 'initial_mode',
                detail: input.modePending
                    ? 'Waiting for the initial workspace mode.'
                    : 'Initial mode resolution is still incomplete.',
            }),
            hasCriticalError: false,
            isReadyToSignal: false,
        };
    }

    const shellBootstrapErrorMessage = normalizeErrorMessage(input.shellBootstrapErrorMessage);
    if (shellBootstrapErrorMessage) {
        return {
            status: createBootStatusSnapshot({
                stage: 'shell_bootstrap_loading',
                source: 'renderer',
                elapsedMs: input.elapsedMs,
                isStuck: true,
                blockingPrerequisite: 'shell_bootstrap',
                detail: `Shell bootstrap failed: ${shellBootstrapErrorMessage}`,
            }),
            hasCriticalError: true,
            isReadyToSignal: false,
        };
    }

    if (!input.shellBootstrapSettled || !input.hasInteractiveShell) {
        return {
            status: createBootStatusSnapshot({
                stage: 'shell_bootstrap_loading',
                source: 'renderer',
                elapsedMs: input.elapsedMs,
                blockingPrerequisite: 'shell_bootstrap',
                detail: 'Waiting for shell bootstrap data to finish loading.',
            }),
            hasCriticalError: false,
            isReadyToSignal: false,
        };
    }

    const readySignalErrorMessage = normalizeErrorMessage(input.readySignalErrorMessage);
    if (input.readySignalState === 'failed') {
        return {
            status: createBootStatusSnapshot({
                stage: 'ready_to_show',
                source: 'renderer',
                elapsedMs: input.elapsedMs,
                isStuck: true,
                blockingPrerequisite: 'renderer_ready_signal',
                detail: readySignalErrorMessage
                    ? `Renderer ready handoff failed: ${readySignalErrorMessage}`
                    : 'Renderer ready handoff failed.',
            }),
            hasCriticalError: true,
            isReadyToSignal: false,
        };
    }

    if (input.readySignalState === 'pending') {
        return {
            status: createBootStatusSnapshot({
                stage: 'ready_to_show',
                source: 'renderer',
                elapsedMs: input.elapsedMs,
                blockingPrerequisite: 'renderer_ready_signal',
                detail: 'Renderer boot finished. Sending the ready handoff to the main process.',
            }),
            hasCriticalError: false,
            isReadyToSignal: false,
        };
    }

    if (input.readySignalState === 'sent') {
        return {
            status: createBootStatusSnapshot({
                stage: 'ready_to_show',
                source: 'renderer',
                elapsedMs: input.elapsedMs,
            }),
            hasCriticalError: false,
            isReadyToSignal: false,
        };
    }

    return {
        status: createBootStatusSnapshot({
            stage: 'ready_to_show',
            source: 'renderer',
            elapsedMs: input.elapsedMs,
            blockingPrerequisite: 'renderer_ready_signal',
            detail: 'Renderer boot finished. Ready to signal the main window.',
        }),
        hasCriticalError: false,
        isReadyToSignal: true,
    };
}
