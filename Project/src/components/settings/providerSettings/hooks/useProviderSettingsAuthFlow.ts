import { useProviderSettingsAuthPolling } from '@/web/components/settings/providerSettings/hooks/useProviderSettingsAuthPolling';
import type { ActiveAuthFlow } from '@/web/components/settings/providerSettings/types';

interface UseProviderSettingsAuthFlowInput {
    profileId: string;
    activeAuthFlow: ActiveAuthFlow | undefined;
    isPolling: boolean;
    pollAuth: (payload: {
        profileId: string;
        providerId: ActiveAuthFlow['providerId'];
        flowId: string;
    }) => Promise<void>;
}

export function useProviderSettingsAuthFlow(input: UseProviderSettingsAuthFlowInput) {
    useProviderSettingsAuthPolling({
        profileId: input.profileId,
        activeAuthFlow: input.activeAuthFlow,
        isPolling: input.isPolling,
        pollAuth: input.pollAuth,
    });
}
