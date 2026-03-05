import { getProviderRuntimeBehavior } from '@/app/backend/providers/behaviors';
import type { ProviderModelCapabilities } from '@/app/backend/providers/types';
import type { RuntimeProviderId, RuntimeRunOptions } from '@/app/backend/runtime/contracts';
import {
    errRunExecution,
    okRunExecution,
    type RunExecutionResult,
} from '@/app/backend/runtime/services/runExecution/errors';

interface ValidateRunCapabilitiesInput {
    providerId: RuntimeProviderId;
    modelId: string;
    modelCapabilities: ProviderModelCapabilities;
    runtimeOptions: RuntimeRunOptions;
}

export function validateRunCapabilities(input: ValidateRunCapabilitiesInput): RunExecutionResult<void> {
    const behavior = getProviderRuntimeBehavior(input.providerId);
    const validation = behavior.validateRunOptions({
        modelId: input.modelId,
        modelCapabilities: input.modelCapabilities,
        runtimeOptions: input.runtimeOptions,
    });
    if (validation.isErr()) {
        return errRunExecution('runtime_option_invalid', validation.error.message);
    }

    return okRunExecution(undefined);
}
