import type { DiffRecord } from '@/app/backend/persistence/types';
import type { CheckpointRollbackPreview } from '@/app/backend/runtime/contracts';

export function resolveSelectedDiffPath(input: {
    selectedDiff: DiffRecord | undefined;
    preferredPath: string | undefined;
}): string | undefined {
    if (input.selectedDiff?.artifact.kind !== 'git') {
        return undefined;
    }

    if (
        input.preferredPath &&
        input.selectedDiff.artifact.files.some((file) => file.path === input.preferredPath)
    ) {
        return input.preferredPath;
    }

    return input.selectedDiff.artifact.files[0]?.path;
}

export function buildRollbackWarningLines(
    preview: CheckpointRollbackPreview | undefined
): { tone: 'isolated' | 'warning'; lines: string[] } | null {
    if (!preview) {
        return null;
    }

    const lines: string[] = [];
    if (preview.isSharedTarget) {
        lines.push('This target is shared. Rolling back here will also affect other chats on the same resolved path.');
    } else {
        lines.push('This checkpoint targets an isolated execution path.');
    }

    if (preview.hasLaterForeignChanges) {
        lines.push('Later checkpoints from other chats exist on this same target. This rollback is high risk.');
    }

    if (preview.affectedSessions.length > 0) {
        lines.push(`Affected chats: ${preview.affectedSessions.map((session) => session.threadTitle).join(', ')}`);
    }

    return {
        tone: preview.isSharedTarget || preview.hasLaterForeignChanges ? 'warning' : 'isolated',
        lines,
    };
}
