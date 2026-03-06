import { trpc } from '@/web/trpc/client';

interface UseConversationShellRoutingBadgeInput {
    profileId: string;
    providerId: string | undefined;
    modelId: string | undefined;
}

export function useConversationShellRoutingBadge(input: UseConversationShellRoutingBadgeInput): string | undefined {
    const kiloRoutingPreferenceQuery = trpc.provider.getModelRoutingPreference.useQuery(
        {
            profileId: input.profileId,
            providerId: 'kilo',
            modelId: input.modelId ?? '',
        },
        {
            enabled: input.providerId === 'kilo' && Boolean(input.modelId),
            refetchOnWindowFocus: false,
        }
    );

    if (input.providerId !== 'kilo') {
        return undefined;
    }

    if (kiloRoutingPreferenceQuery.data?.preference.routingMode === 'pinned') {
        return `Routing: Pinned (${kiloRoutingPreferenceQuery.data.preference.pinnedProviderId ?? 'unknown'})`;
    }

    return `Routing: Dynamic (${
        kiloRoutingPreferenceQuery.data?.preference.sort === 'price'
            ? 'Lowest Price'
            : kiloRoutingPreferenceQuery.data?.preference.sort === 'throughput'
              ? 'Highest Throughput'
              : kiloRoutingPreferenceQuery.data?.preference.sort === 'latency'
                ? 'Lowest Latency'
                : 'Default'
    })`;
}
