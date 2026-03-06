import { trpc } from '@/web/trpc/client';

export function useDiagnosticRuntimeSnapshot(profileId: string) {
    return trpc.runtime.getDiagnosticSnapshot.useQuery(
        { profileId },
        {
            refetchOnWindowFocus: false,
        }
    );
}
