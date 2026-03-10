import { useEffect } from 'react';

import { startWorkspaceBootPrefetch } from '@/web/components/runtime/workspaceBootLoader';

interface WorkspaceBootPrefetchInput {
    trpcUtils: Parameters<typeof startWorkspaceBootPrefetch>[0]['trpcUtils'];
}

export function useWorkspaceBootPrefetch(input: WorkspaceBootPrefetchInput): void {
    useEffect(() => {
        void startWorkspaceBootPrefetch({
            trpcUtils: input.trpcUtils,
        }).catch(() => {
            // Boot prefetch is opportunistic; normal queries still resolve the shell.
        });
    }, [input.trpcUtils]);
}
