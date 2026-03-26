import { useState } from 'react';

import type { ActiveAuthFlow } from '@/web/components/settings/providerSettings/types';

import type { RuntimeProviderId } from '@/shared/contracts';

interface ProviderSettingsSelectionStateOptions {
    initialProviderId?: RuntimeProviderId;
}

export function useProviderSettingsSelectionState(options?: ProviderSettingsSelectionStateOptions) {
    const [requestedProviderId, setRequestedProviderId] = useState<RuntimeProviderId | undefined>(
        () => options?.initialProviderId
    );
    const [requestedModelId, setRequestedModelId] = useState('');
    const [activeAuthFlow, setActiveAuthFlow] = useState<ActiveAuthFlow | undefined>(undefined);
    const [statusMessage, setStatusMessage] = useState<string | undefined>(undefined);

    return {
        requestedProviderId,
        setRequestedProviderId,
        requestedModelId,
        setRequestedModelId,
        activeAuthFlow,
        setActiveAuthFlow,
        statusMessage,
        setStatusMessage,
    };
}
