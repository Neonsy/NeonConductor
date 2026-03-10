import type { ProviderListItem } from '@/web/components/settings/providerSettings/types';

import type { ProviderModelRecord } from '@/app/backend/persistence/types';

import type { RuntimeProviderId } from '@/shared/contracts';

export function resolveSelectedProviderId(
    providers: ProviderListItem[],
    selectedProviderId: RuntimeProviderId | undefined
): RuntimeProviderId | undefined {
    if (selectedProviderId && providers.some((provider) => provider.id === selectedProviderId)) {
        return selectedProviderId;
    }

    return providers.find((provider) => provider.isDefault)?.id ?? providers[0]?.id;
}

export function resolveSelectedModelId(input: {
    selectedProviderId: string | undefined;
    selectedModelId: string;
    models: ProviderModelRecord[];
    defaults:
        | {
              providerId: string;
              modelId: string;
          }
        | undefined;
}): string {
    if (!input.selectedProviderId) {
        return input.selectedModelId;
    }

    if (input.selectedModelId && input.models.some((model) => model.id === input.selectedModelId)) {
        return input.selectedModelId;
    }

    if (
        input.defaults?.providerId === input.selectedProviderId &&
        input.models.some((model) => model.id === input.defaults?.modelId)
    ) {
        return input.defaults.modelId;
    }

    return input.models[0]?.id ?? '';
}

