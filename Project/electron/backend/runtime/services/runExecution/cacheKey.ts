import { getProviderRuntimeBehavior } from '@/app/backend/providers/behaviors';
import type { RuntimeRunOptions } from '@/app/backend/runtime/contracts';
import type { RuntimeProviderId } from '@/app/backend/runtime/contracts';
import {
    errRunExecution,
    okRunExecution,
    type RunExecutionResult,
} from '@/app/backend/runtime/services/runExecution/errors';
import type { RunCacheResolution } from '@/app/backend/runtime/services/runExecution/types';

interface ResolveRunCacheInput {
    profileId: string;
    sessionId: string;
    providerId: RuntimeProviderId;
    modelId: string;
    runtimeOptions: RuntimeRunOptions;
}

export function resolveRunCache(input: ResolveRunCacheInput): RunExecutionResult<RunCacheResolution> {
    const behavior = getProviderRuntimeBehavior(input.providerId);
    const cacheResolution = behavior.resolveCache({
        profileId: input.profileId,
        sessionId: input.sessionId,
        modelId: input.modelId,
        runtimeOptions: input.runtimeOptions,
    });
    if (cacheResolution.isErr()) {
        return errRunExecution('cache_resolution_failed', cacheResolution.error.message);
    }

    return okRunExecution(cacheResolution.value);
}
