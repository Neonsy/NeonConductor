export interface ConversationShellBootChromeReadiness {
    shellBootstrapSettled: boolean;
}

export interface WorkspaceBootReadinessInput extends ConversationShellBootChromeReadiness {
    hasResolvedProfile: boolean;
    hasResolvedInitialMode: boolean;
    hasInteractiveShell: boolean;
}

export const INITIAL_CONVERSATION_SHELL_BOOT_CHROME_READINESS: ConversationShellBootChromeReadiness = {
    shellBootstrapSettled: false,
};

export function isWorkspaceBootReady(input: WorkspaceBootReadinessInput): boolean {
    return (
        input.hasResolvedProfile &&
        input.hasResolvedInitialMode &&
        input.shellBootstrapSettled &&
        input.hasInteractiveShell
    );
}
