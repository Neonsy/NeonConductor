import type { DiffRecord } from '@/app/backend/persistence/types';

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
