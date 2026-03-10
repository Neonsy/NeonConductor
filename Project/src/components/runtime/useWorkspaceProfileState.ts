import { useState } from 'react';

import { BOOT_CRITICAL_QUERY_OPTIONS } from '@/web/components/runtime/startupQueryOptions';
import { resolveActiveWorkspaceProfileId } from '@/web/components/runtime/workspaceSurfaceModel';
import { trpc } from '@/web/trpc/client';

import type { TopLevelTab } from '@/app/backend/runtime/contracts';

export function useWorkspaceProfileState(input: { setTopLevelTab: (value: TopLevelTab) => void }) {
    const [activeProfileId, setActiveProfileId] = useState<string | undefined>(undefined);
    const utils = trpc.useUtils();

    const profileListQuery = trpc.profile.list.useQuery(undefined, BOOT_CRITICAL_QUERY_OPTIONS);
    const activeProfileQuery = trpc.profile.getActive.useQuery(undefined, BOOT_CRITICAL_QUERY_OPTIONS);

    const profiles = profileListQuery.data?.profiles ?? [];
    const resolvedProfileId = resolveActiveWorkspaceProfileId({
        activeProfileId,
        serverActiveProfileId: activeProfileQuery.data?.activeProfileId,
        profiles,
    });

    const profileSetActiveMutation = trpc.profile.setActive.useMutation({
        onSuccess: (result) => {
            if (!result.updated) {
                return;
            }

            setActiveProfileId(result.profile.id);
            input.setTopLevelTab('chat');
            utils.profile.getActive.setData(undefined, {
                activeProfileId: result.profile.id,
                profile: result.profile,
            });
            utils.profile.list.setData(undefined, (current) => {
                if (!current) {
                    return current;
                }

                return {
                    profiles: current.profiles.map((profile) => ({
                        ...profile,
                        isActive: profile.id === result.profile.id,
                    })),
                };
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
