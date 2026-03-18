import { orchestratorExecutionStrategies } from '@/app/backend/runtime/contracts/enums';
import {
    createParser,
    parseRuntimeRunOptions,
    readEntityId,
    readEnumValue,
    readObject,
    readOptionalString,
    readProfileId,
    readProviderId,
} from '@/app/backend/runtime/contracts/parsers/helpers';
import type {
    OrchestratorRunByIdInput,
    OrchestratorRunBySessionInput,
    OrchestratorStartInput,
} from '@/app/backend/runtime/contracts/types';

export function parseOrchestratorStartInput(input: unknown): OrchestratorStartInput {
    const source = readObject(input, 'input');
    const providerId = source.providerId !== undefined ? readProviderId(source.providerId, 'providerId') : undefined;
    const modelId = readOptionalString(source.modelId, 'modelId');
    const workspaceFingerprint = readOptionalString(source.workspaceFingerprint, 'workspaceFingerprint');
    const executionStrategy =
        source.executionStrategy !== undefined
            ? readEnumValue(source.executionStrategy, 'executionStrategy', orchestratorExecutionStrategies)
            : undefined;

    return {
        profileId: readProfileId(source),
        planId: readEntityId(source.planId, 'planId', 'plan'),
        runtimeOptions: parseRuntimeRunOptions(source.runtimeOptions),
        ...(executionStrategy ? { executionStrategy } : {}),
        ...(providerId ? { providerId } : {}),
        ...(modelId ? { modelId } : {}),
        ...(workspaceFingerprint ? { workspaceFingerprint } : {}),
    };
}

export function parseOrchestratorRunByIdInput(input: unknown): OrchestratorRunByIdInput {
    const source = readObject(input, 'input');

    return {
        profileId: readProfileId(source),
        orchestratorRunId: readEntityId(source.orchestratorRunId, 'orchestratorRunId', 'orch'),
    };
}

export function parseOrchestratorRunBySessionInput(input: unknown): OrchestratorRunBySessionInput {
    const source = readObject(input, 'input');

    return {
        profileId: readProfileId(source),
        sessionId: readEntityId(source.sessionId, 'sessionId', 'sess'),
    };
}

export const orchestratorStartInputSchema = createParser(parseOrchestratorStartInput);
export const orchestratorRunByIdInputSchema = createParser(parseOrchestratorRunByIdInput);
export const orchestratorRunBySessionInputSchema = createParser(parseOrchestratorRunBySessionInput);
