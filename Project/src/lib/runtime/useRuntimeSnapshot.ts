import { useEffect } from 'react';

import { useRuntimeEventStreamStore } from '@/web/lib/runtime/eventStream';
import { trpc } from '@/web/trpc/client';

export function useRuntimeSnapshot(profileId: string) {
    const lastSequence = useRuntimeEventStreamStore((state) => state.lastSequence);
    const snapshotQuery = trpc.runtime.getSnapshot.useQuery(
        { profileId },
        {
            refetchOnWindowFocus: false,
        }
    );

    useEffect(() => {
        if (lastSequence <= 0) {
            return;
        }

        const timer = window.setTimeout(() => {
            void snapshotQuery.refetch();
        }, 120);

        return () => {
            window.clearTimeout(timer);
        };
    }, [lastSequence, snapshotQuery]);

    return snapshotQuery;
}
