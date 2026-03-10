import { useEffect, useState } from 'react';

import { BOOT_CRITICAL_QUERY_OPTIONS } from '@/web/components/runtime/startupQueryOptions';
import { resolveActiveWorkspaceProfileId } from '@/web/components/runtime/workspaceSurfaceModel';
import { refetchWorkspaceProfileQueries } from '@/web/components/runtime/workspaceSurfaceRefetch';
import { trpc } from '@/web/trpc/client';

import type { TopLevelTab } from '@/app/backend/runtime/contracts';

export function useWorkspaceProfileState(input: { setTopLevelTab: (value: TopLevelTab) => void }) {
    const [activeProfileId, setActiveProfileId] = useState<string | undefined>(undefined);

    const profileListQuery = trpc.profile.list.useQuery(undefined, BOOT_CRITICAL_QUERY_OPTIONS);
    const activeProfileQuery = trpc.profile.getActive.useQuery(undefined, BOOT_CRITICAL_QUERY_OPTIONS);

    const profiles = profileListQuery.data?.profiles ?? [];
    const resolvedProfileId = resolveActiveWorkspaceProfileId({
        activeProfileId,
        serverActiveProfileId: activeProfileQuery.data?.activeProfileId,
        profiles,
    });

    useEffect(() => {
        if (!resolvedProfileId || resolvedProfileId === activeProfileId) {
            return;
        }

        setActiveProfileId(resolvedProfileId);
    }, [activeProfileId, resolvedProfileId]);

    const profileSetActiveMutation = trpc.profile.setActive.useMutation({
        onSuccess: async (result) => {
            if (!result.updated) {
                return;
            }

            setActiveProfileId(result.profile.id);
            input.setTopLevelTab('chat');
            await refetchWorkspaceProfileQueries({
                profileListQuery,
                activeProfileQuery,
            });
        },
    });

    return {
        profiles,
        resolvedProfileId,
        profileSetActiveMutation,
        setResolvedProfile: (profileId: string) => {
            setActiveProfileId(profileId);
            input.setTopLevelTab('chat');
            void refetchWorkspaceProfileQueries({
                profileListQuery,
                activeProfileQuery,
            });
        },
        selectProfile: async (profileId: string) => {
            if (!profileId || profileId === resolvedProfileId) {
                return;
            }

            await profileSetActiveMutation.mutateAsync({
                profileId,
            });
        },
    };
}
