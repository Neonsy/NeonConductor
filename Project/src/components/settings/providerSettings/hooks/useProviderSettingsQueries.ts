import { useProviderSettingsReadModel } from '@/web/components/settings/providerSettings/hooks/useProviderSettingsReadModel';
import { useProviderSettingsSupplementalQueries } from '@/web/components/settings/providerSettings/hooks/useProviderSettingsSupplementalQueries';

import type { RuntimeProviderId } from '@/shared/contracts';

interface UseProviderSettingsQueriesInput {
    profileId: string;
    requestedProviderId: RuntimeProviderId | undefined;
    requestedModelId: string;
}

export function useProviderSettingsQueries(input: UseProviderSettingsQueriesInput) {
    const readModel = useProviderSettingsReadModel({
        profileId: input.profileId,
        requestedProviderId: input.requestedProviderId,
        requestedModelId: input.requestedModelId,
    });
    const supplementalQueries = useProviderSettingsSupplementalQueries({
        profileId: input.profileId,
        selectedProviderId: readModel.selectedProviderId,
        selectedModelId: readModel.selectedModelId,
    });

    return {
        ...readModel,
        ...supplementalQueries,
    };
}
