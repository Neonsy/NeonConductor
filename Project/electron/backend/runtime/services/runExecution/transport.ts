import { getProviderRuntimeBehavior } from '@/app/backend/providers/behaviors';
import type { RuntimeRunOptions } from '@/app/backend/runtime/contracts';
import type { RuntimeProviderId } from '@/app/backend/runtime/contracts';
import type { RunTransportResolution } from '@/app/backend/runtime/services/runExecution/types';

interface ResolveInitialRunTransportInput {
    providerId: RuntimeProviderId;
    runtimeOptions: RuntimeRunOptions;
}

export function resolveInitialRunTransport(input: ResolveInitialRunTransportInput): RunTransportResolution {
    const behavior = getProviderRuntimeBehavior(input.providerId);
    return behavior.resolveInitialTransport(input.runtimeOptions);
}
