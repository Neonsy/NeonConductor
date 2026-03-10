import { SECONDARY_QUERY_OPTIONS } from '@/web/lib/query/secondaryQueryOptions';
import { trpc } from '@/web/trpc/client';

export function useDiagnosticRuntimeSnapshot(profileId: string) {
    return trpc.runtime.getDiagnosticSnapshot.useQuery({ profileId }, SECONDARY_QUERY_OPTIONS);
}
