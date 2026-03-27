import { useState } from 'react';

import { resolveSelectedProfileId } from '@/web/components/settings/profileSettings/selection';
import { PROGRESSIVE_QUERY_OPTIONS } from '@/web/lib/query/progressiveQueryOptions';
import { trpc } from '@/web/trpc/client';

interface ContextSelectionStateInput {
    activeProfileId: string;
    onSelectionChanged?: () => void;
}

export function useContextSelectionState(input: ContextSelectionStateInput) {
    const [selectedProfileId, setSelectedProfileId] = useState(input.activeProfileId);
    const profilesQuery = trpc.profile.list.useQuery(undefined, PROGRESSIVE_QUERY_OPTIONS);
    const profiles = profilesQuery.data?.profiles ?? [];
    const resolvedSelectedProfileId =
        resolveSelectedProfileId(profiles, selectedProfileId, input.activeProfileId) ?? input.activeProfileId;

    return {
        profiles,
        selectedProfileId: resolvedSelectedProfileId,
        setSelectedProfileId: (profileId: string) => {
            setSelectedProfileId(profileId);
            input.onSelectionChanged?.();
        },
    };
}
