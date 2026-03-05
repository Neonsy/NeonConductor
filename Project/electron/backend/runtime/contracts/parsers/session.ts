import { sessionKinds, topLevelTabs } from '@/app/backend/runtime/contracts/enums';
import {
    createParser,
    parseRuntimeRunOptions,
    readEntityId,
    readEnumValue,
    readObject,
    readOptionalString,
    readProfileId,
    readProviderId,
    readString,
} from '@/app/backend/runtime/contracts/parsers/helpers';
import type {
    SessionByIdInput,
    SessionCreateInput,
    SessionListMessagesInput,
    SessionListRunsInput,
    SessionStartRunInput,
} from '@/app/backend/runtime/contracts/types';

export function parseSessionCreateInput(input: unknown): SessionCreateInput {
    const source = readObject(input, 'input');

    return {
        profileId: readProfileId(source),
        threadId: readEntityId(source.threadId, 'threadId', 'thr'),
        kind: readEnumValue(source.kind, 'kind', sessionKinds),
    };
}

export function parseSessionByIdInput(input: unknown): SessionByIdInput {
    const source = readObject(input, 'input');

    return {
        profileId: readProfileId(source),
        sessionId: readEntityId(source.sessionId, 'sessionId', 'sess'),
    };
}

export function parseSessionStartRunInput(input: unknown): SessionStartRunInput {
    const source = readObject(input, 'input');
    const providerId = source.providerId !== undefined ? readProviderId(source.providerId, 'providerId') : undefined;
    const modelId = readOptionalString(source.modelId, 'modelId');
    const workspaceFingerprint = readOptionalString(source.workspaceFingerprint, 'workspaceFingerprint');
    const runtimeOptions = parseRuntimeRunOptions(source.runtimeOptions);

    return {
        profileId: readProfileId(source),
        sessionId: readEntityId(source.sessionId, 'sessionId', 'sess'),
        prompt: readString(source.prompt, 'prompt'),
        topLevelTab: readEnumValue(source.topLevelTab, 'topLevelTab', topLevelTabs),
        modeKey: readString(source.modeKey, 'modeKey'),
        ...(workspaceFingerprint ? { workspaceFingerprint } : {}),
        runtimeOptions,
        ...(providerId ? { providerId } : {}),
        ...(modelId ? { modelId } : {}),
    };
}

export function parseSessionListRunsInput(input: unknown): SessionListRunsInput {
    return parseSessionByIdInput(input);
}

export function parseSessionListMessagesInput(input: unknown): SessionListMessagesInput {
    const source = readObject(input, 'input');
    const runId = source.runId !== undefined ? readEntityId(source.runId, 'runId', 'run') : undefined;

    return {
        profileId: readProfileId(source),
        sessionId: readEntityId(source.sessionId, 'sessionId', 'sess'),
        ...(runId ? { runId } : {}),
    };
}

export const sessionCreateInputSchema = createParser(parseSessionCreateInput);
export const sessionByIdInputSchema = createParser(parseSessionByIdInput);
export const sessionStartRunInputSchema = createParser(parseSessionStartRunInput);
export const sessionListRunsInputSchema = createParser(parseSessionListRunsInput);
export const sessionListMessagesInputSchema = createParser(parseSessionListMessagesInput);
