import { useState } from 'react';

import { resolveSelectedProfileId } from '@/web/components/settings/profileSettings/selection';
import { PROGRESSIVE_QUERY_OPTIONS } from '@/web/lib/query/progressiveQueryOptions';
import { trpc } from '@/web/trpc/client';

import type { ProfileRecord } from '@/app/backend/persistence/types';

export interface ProfileSelectionState {
    profiles: ProfileRecord[];
    selectedProfileId: string | undefined;
    resolvedSelectedProfileId: string | undefined;
    selectedProfile: ProfileRecord | undefined;
    selectedProfileIdForSettings: string;
    setSelectedProfileId: (profileId: string | undefined) => void;
}

export function useProfileSelectionState(input: { activeProfileId: string }) {
    const [selectedProfileId, setSelectedProfileId] = useState<string | undefined>(undefined);

    const profilesQuery = trpc.profile.list.useQuery(undefined, PROGRESSIVE_QUERY_OPTIONS);
    const profiles = profilesQuery.data?.profiles ?? [];
    const resolvedSelectedProfileId = resolveSelectedProfileId(profiles, selectedProfileId, input.activeProfileId);
    const selectedProfile = resolvedSelectedProfileId
        ? profiles.find((profile) => profile.id === resolvedSelectedProfileId)
        : undefined;
    const selectedProfileIdForSettings = resolvedSelectedProfileId ?? input.activeProfileId;

    return {
        profiles,
        selectedProfileId: resolvedSelectedProfileId,
        resolvedSelectedProfileId,
        selectedProfile,
        selectedProfileIdForSettings,
        setSelectedProfileId,
    } satisfies ProfileSelectionState;
}
