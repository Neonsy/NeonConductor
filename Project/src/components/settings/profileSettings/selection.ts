import type { ProfileRecord } from '@/app/backend/persistence/types';

export function resolveSelectedProfileId(
    profiles: ProfileRecord[],
    selectedProfileId: string | undefined,
    activeProfileId: string
): string | undefined {
    if (profiles.length === 0) {
        return undefined;
    }

    if (selectedProfileId && profiles.some((profile) => profile.id === selectedProfileId)) {
        return selectedProfileId;
    }

    if (profiles.some((profile) => profile.id === activeProfileId)) {
        return activeProfileId;
    }

    return profiles[0]?.id;
}
