import type { ProfileRecord } from '@/app/backend/persistence/types';

export interface ProfileRenameDraft {
    profileId: string;
    value: string;
}

export function resolveProfileRenameValue(input: {
    selectedProfile: ProfileRecord | undefined;
    renameDraft: ProfileRenameDraft | undefined;
}): string {
    if (input.selectedProfile && input.renameDraft?.profileId === input.selectedProfile.id) {
        return input.renameDraft.value;
    }

    return input.selectedProfile?.name ?? '';
}
