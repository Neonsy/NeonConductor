import { formatRoutingBadge } from '@/web/components/conversation/routingBadge';
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

    return formatRoutingBadge(input.providerId, kiloRoutingPreferenceQuery.data?.preference);
}
