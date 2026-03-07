import { sessionEditModes, sessionKinds, topLevelTabs } from '@/app/backend/runtime/contracts/enums';
import {
    createParser,
    parseRuntimeRunOptions,
    readBoolean,
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
    SessionEditInput,
    SessionGetAttachedSkillsInput,
    SessionListMessagesInput,
    SessionListRunsInput,
    SessionRevertInput,
    SessionSetAttachedSkillsInput,
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

export function parseSessionRevertInput(input: unknown): SessionRevertInput {
    const source = readObject(input, 'input');

    return {
        profileId: readProfileId(source),
        sessionId: readEntityId(source.sessionId, 'sessionId', 'sess'),
        topLevelTab: readEnumValue(source.topLevelTab, 'topLevelTab', topLevelTabs),
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

export function parseSessionGetAttachedSkillsInput(input: unknown): SessionGetAttachedSkillsInput {
    return parseSessionByIdInput(input);
}

export function parseSessionSetAttachedSkillsInput(input: unknown): SessionSetAttachedSkillsInput {
    const source = readObject(input, 'input');
    const rawAssetKeys = source.assetKeys;
    if (!Array.isArray(rawAssetKeys)) {
        throw new Error('Invalid "assetKeys": expected array.');
    }

    return {
        profileId: readProfileId(source),
        sessionId: readEntityId(source.sessionId, 'sessionId', 'sess'),
        assetKeys: rawAssetKeys.map((value, index) => readString(value, `assetKeys[${String(index)}]`)),
    };
}

export function parseSessionEditInput(input: unknown): SessionEditInput {
    const source = readObject(input, 'input');
    const providerId = source.providerId !== undefined ? readProviderId(source.providerId, 'providerId') : undefined;
    const modelId = readOptionalString(source.modelId, 'modelId');
    const workspaceFingerprint = readOptionalString(source.workspaceFingerprint, 'workspaceFingerprint');
    const runtimeOptions =
        source.runtimeOptions !== undefined ? parseRuntimeRunOptions(source.runtimeOptions) : undefined;
    const modeKey = readOptionalString(source.modeKey, 'modeKey');
    const autoStartRun =
        source.autoStartRun !== undefined ? readBoolean(source.autoStartRun, 'autoStartRun') : undefined;

    return {
        profileId: readProfileId(source),
        sessionId: readEntityId(source.sessionId, 'sessionId', 'sess'),
        topLevelTab: readEnumValue(source.topLevelTab, 'topLevelTab', topLevelTabs),
        messageId: readEntityId(source.messageId, 'messageId', 'msg'),
        replacementText: readString(source.replacementText, 'replacementText'),
        editMode: readEnumValue(source.editMode, 'editMode', sessionEditModes),
        ...(modeKey ? { modeKey } : {}),
        ...(autoStartRun !== undefined ? { autoStartRun } : {}),
        ...(workspaceFingerprint ? { workspaceFingerprint } : {}),
        ...(runtimeOptions ? { runtimeOptions } : {}),
        ...(providerId ? { providerId } : {}),
        ...(modelId ? { modelId } : {}),
    };
}

export const sessionCreateInputSchema = createParser(parseSessionCreateInput);
export const sessionByIdInputSchema = createParser(parseSessionByIdInput);
export const sessionRevertInputSchema = createParser(parseSessionRevertInput);
export const sessionStartRunInputSchema = createParser(parseSessionStartRunInput);
export const sessionListRunsInputSchema = createParser(parseSessionListRunsInput);
export const sessionListMessagesInputSchema = createParser(parseSessionListMessagesInput);
export const sessionGetAttachedSkillsInputSchema = createParser(parseSessionGetAttachedSkillsInput);
export const sessionSetAttachedSkillsInputSchema = createParser(parseSessionSetAttachedSkillsInput);
export const sessionEditInputSchema = createParser(parseSessionEditInput);
