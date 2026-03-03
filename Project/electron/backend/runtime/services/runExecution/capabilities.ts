import { getProviderRuntimeBehavior } from '@/app/backend/providers/behaviors';
import type { ProviderModelCapabilities } from '@/app/backend/providers/types';
import type { RuntimeProviderId, RuntimeRunOptions } from '@/app/backend/runtime/contracts';

interface ValidateRunCapabilitiesInput {
    providerId: RuntimeProviderId;
    modelId: string;
    modelCapabilities: ProviderModelCapabilities;
    runtimeOptions: RuntimeRunOptions;
}

export function validateRunCapabilities(input: ValidateRunCapabilitiesInput): void {
    const behavior = getProviderRuntimeBehavior(input.providerId);
    behavior.validateRunOptions({
        modelId: input.modelId,
        modelCapabilities: input.modelCapabilities,
        runtimeOptions: input.runtimeOptions,
    });
}
