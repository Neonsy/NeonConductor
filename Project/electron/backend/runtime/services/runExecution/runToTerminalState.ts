import type { ProviderRuntimeTransportSelection } from '@/app/backend/providers/types';
import type { ProviderAuthMethod, RuntimeProviderId } from '@/app/backend/runtime/contracts';
import { executeRun, isAbortError } from '@/app/backend/runtime/services/runExecution/executeRun';
import { moveRunToAbortedState, moveRunToFailedState } from '@/app/backend/runtime/services/runExecution/terminalState';
import type { ResolvedKiloRouting, RunCacheResolution, RunContextMessage, StartRunInput } from '@/app/backend/runtime/services/runExecution/types';

export async function runToTerminalState(input: {
    profileId: string;
    sessionId: string;
    runId: string;
    prompt: string;
    providerId: RuntimeProviderId;
    modelId: string;
    authMethod: ProviderAuthMethod | 'none';
    runtimeOptions: StartRunInput['runtimeOptions'];
    cache: RunCacheResolution;
    transportSelection: ProviderRuntimeTransportSelection;
    apiKey?: string;
    accessToken?: string;
    organizationId?: string;
    kiloRouting?: ResolvedKiloRouting;
    contextMessages?: RunContextMessage[];
    assistantMessageId: string;
    signal: AbortSignal;
}): Promise<void> {
    try {
        const executionResult = await executeRun(input);
        if (executionResult.isErr()) {
            if (input.signal.aborted) {
                await moveRunToAbortedState({
                    profileId: input.profileId,
                    sessionId: input.sessionId,
                    runId: input.runId,
                    logMessage: 'Run moved to aborted terminal state.',
                });
                return;
            }
            await moveRunToFailedState({
                profileId: input.profileId,
                sessionId: input.sessionId,
                runId: input.runId,
                errorCode: executionResult.error.code,
                errorMessage: executionResult.error.message,
                logMessage: 'Run moved to failed terminal state.',
            });
            return;
        }
    } catch (error) {
        if (isAbortError(error) || input.signal.aborted) {
            await moveRunToAbortedState({
                profileId: input.profileId,
                sessionId: input.sessionId,
                runId: input.runId,
                logMessage: 'Run moved to aborted terminal state.',
            });
            return;
        }

        const message = error instanceof Error ? error.message : String(error);
        await moveRunToFailedState({
            profileId: input.profileId,
            sessionId: input.sessionId,
            runId: input.runId,
            errorCode: 'invariant_violation',
            errorMessage: message,
            logMessage: 'Run moved to failed terminal state.',
        });
    }
}
