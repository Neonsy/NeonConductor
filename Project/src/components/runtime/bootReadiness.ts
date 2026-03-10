export interface ConversationShellBootChromeReadiness {
    shellBootstrapSettled: boolean;
    bucketListSettled: boolean;
    tagListSettled: boolean;
    threadListSettled: boolean;
    sessionListSettled: boolean;
}

export interface WorkspaceBootReadinessInput extends ConversationShellBootChromeReadiness {
    hasResolvedProfile: boolean;
    hasResolvedInitialMode: boolean;
    hasInteractiveShell: boolean;
}

export const INITIAL_CONVERSATION_SHELL_BOOT_CHROME_READINESS: ConversationShellBootChromeReadiness = {
    shellBootstrapSettled: false,
    bucketListSettled: false,
    tagListSettled: false,
    threadListSettled: false,
    sessionListSettled: false,
};

export function isWorkspaceBootReady(input: WorkspaceBootReadinessInput): boolean {
    return (
        input.hasResolvedProfile &&
        input.hasResolvedInitialMode &&
        input.shellBootstrapSettled &&
        input.bucketListSettled &&
        input.tagListSettled &&
        input.threadListSettled &&
        input.sessionListSettled &&
        input.hasInteractiveShell
    );
}
