import { skipToken } from '@tanstack/react-query';

import { resolveContextPreviewTarget } from '@/web/components/settings/contextSettings/contextTargetPreview';
import { PROGRESSIVE_QUERY_OPTIONS } from '@/web/lib/query/progressiveQueryOptions';
import { trpc } from '@/web/trpc/client';

export function useContextPreviewReadModel(input: { profileId: string }) {
    const shellBootstrapQuery = trpc.runtime.getShellBootstrap.useQuery(
        { profileId: input.profileId },
        { enabled: input.profileId.length > 0, ...PROGRESSIVE_QUERY_OPTIONS }
    );

    const providerControl = shellBootstrapQuery.data?.providerControl;
    const resolvedPreviewTarget = resolveContextPreviewTarget({
        profileId: input.profileId,
        providerControl,
    });
    const resolvedContextStateQueryInput = resolvedPreviewTarget?.previewQueryInput;
    const resolvedContextStateQuery = resolvedContextStateQueryInput
        ? trpc.context.getResolvedState.useQuery(resolvedContextStateQueryInput, {
              ...PROGRESSIVE_QUERY_OPTIONS,
          })
        : trpc.context.getResolvedState.useQuery(skipToken, {
              ...PROGRESSIVE_QUERY_OPTIONS,
          });

    return {
        shellBootstrapQuery,
        resolvedPreviewTarget,
        resolvedContextStateQueryInput,
        resolvedContextStateQuery,
    };
}
