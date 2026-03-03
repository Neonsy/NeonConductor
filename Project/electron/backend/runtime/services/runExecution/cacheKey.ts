import { getProviderRuntimeBehavior } from '@/app/backend/providers/behaviors';
import type { RuntimeRunOptions } from '@/app/backend/runtime/contracts';
import type { RuntimeProviderId } from '@/app/backend/runtime/contracts';
import type { RunCacheResolution } from '@/app/backend/runtime/services/runExecution/types';

interface ResolveRunCacheInput {
    profileId: string;
    sessionId: string;
    providerId: RuntimeProviderId;
    modelId: string;
    runtimeOptions: RuntimeRunOptions;
}

export function resolveRunCache(input: ResolveRunCacheInput): RunCacheResolution {
    const behavior = getProviderRuntimeBehavior(input.providerId);
    return behavior.resolveCache({
        profileId: input.profileId,
        sessionId: input.sessionId,
        modelId: input.modelId,
        runtimeOptions: input.runtimeOptions,
    });
}
