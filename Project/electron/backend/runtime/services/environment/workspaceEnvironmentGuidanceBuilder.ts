import type { WorkspaceEnvironmentSnapshot } from '@/app/backend/runtime/contracts/types/runtime';

export function buildWorkspaceEnvironmentGuidance(
    snapshot: WorkspaceEnvironmentSnapshot,
    options?: {
        vendoredRipgrepAvailable?: boolean;
    }
): string {
    const shellLine =
        snapshot.platform === 'win32' && !snapshot.shellExecutable
            ? `Platform: ${snapshot.platform}. Windows shell could not be resolved.`
            : `Platform: ${snapshot.platform}. Shell family: ${snapshot.shellFamily}.${snapshot.shellExecutable ? ` Shell executable: ${snapshot.shellExecutable}.` : ''}`;
    const lines = [
        `Effective root: ${snapshot.workspaceRootPath}.`,
        shellLine,
    ];

    if (snapshot.baseWorkspaceRootPath) {
        lines.push(`Base workspace root: ${snapshot.baseWorkspaceRootPath}.`);
    }

    if (snapshot.effectivePreferences.vcs.family !== 'unknown') {
        lines.push(`Preferred VCS: ${snapshot.effectivePreferences.vcs.family}.`);
    }

    if (snapshot.effectivePreferences.packageManager.family !== 'unknown') {
        lines.push(`Preferred package manager: ${snapshot.effectivePreferences.packageManager.family}.`);
    }

    if (options?.vendoredRipgrepAvailable) {
        lines.push(
            'For ordinary workspace text search, prefer the native search_files tool. If shell-based search is specifically needed, prefer rg and rg --files.'
        );
    }

    return [...lines, ...snapshot.notes].join(' ');
}
