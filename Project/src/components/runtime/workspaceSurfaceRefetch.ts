import { trpc } from '@/web/trpc/client';

export async function refetchWorkspaceProfileQueries(input: {
    profileListQuery: ReturnType<typeof trpc.profile.list.useQuery>;
    activeProfileQuery: ReturnType<typeof trpc.profile.getActive.useQuery>;
}): Promise<void> {
    await Promise.all([input.profileListQuery.refetch(), input.activeProfileQuery.refetch()]);
}

export async function refetchWorkspaceModeQueries(input: {
    modeListQuery: ReturnType<typeof trpc.mode.list.useQuery>;
    modeActiveQuery: ReturnType<typeof trpc.mode.getActive.useQuery>;
}): Promise<void> {
    await Promise.all([input.modeListQuery.refetch(), input.modeActiveQuery.refetch()]);
}
