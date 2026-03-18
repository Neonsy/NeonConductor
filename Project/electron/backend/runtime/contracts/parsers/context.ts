import { contextProfileOverrideModes, contextSettingModes, topLevelTabs } from '@/app/backend/runtime/contracts/enums';
import {
    createParser,
    readBoolean,
    readEntityId,
    readEnumValue,
    readObject,
    readOptionalNumber,
    readOptionalString,
    readProfileId,
    readProviderId,
    readString,
} from '@/app/backend/runtime/contracts/parsers/helpers';
import type {
    CompactSessionInput,
    ContextPolicyInput,
    ResolvedContextStateInput,
    SetContextGlobalSettingsInput,
    SetContextProfileSettingsInput,
} from '@/app/backend/runtime/contracts/types/context';

function readPercentValue(value: unknown, field: string): number {
    const percent = readOptionalNumber(value, field);
    if (percent === undefined || !Number.isInteger(percent) || percent < 1 || percent > 100) {
        throw new Error(`Invalid "${field}": expected integer between 1 and 100.`);
    }
    return percent;
}

function readOptionalPercentValue(value: unknown, field: string): number | undefined {
    if (value === undefined) {
        return undefined;
    }
    return readPercentValue(value, field);
}

function readFixedInputTokens(value: unknown, field: string): number | undefined {
    const fixedInputTokens = readOptionalNumber(value, field);
    if (fixedInputTokens === undefined) {
        return undefined;
    }
    if (!Number.isInteger(fixedInputTokens) || fixedInputTokens < 1) {
        throw new Error(`Invalid "${field}": expected positive integer.`);
    }
    return fixedInputTokens;
}

function readOptionalContextPreviewTarget(value: unknown, field: string) {
    if (value === undefined) {
        return undefined;
    }

    const source = readObject(value, field);
    return {
        profileId: readProfileId(source),
        providerId: readProviderId(source.providerId, `${field}.providerId`),
        modelId: readString(source.modelId, `${field}.modelId`),
    };
}

export function parseContextPolicyInput(input: unknown): ContextPolicyInput {
    const source = readObject(input, 'input');
    return {
        profileId: readProfileId(source),
        providerId: readProviderId(source.providerId, 'providerId'),
        modelId: readString(source.modelId, 'modelId'),
    };
}

export function parseSetContextGlobalSettingsInput(input: unknown): SetContextGlobalSettingsInput {
    const source = readObject(input, 'input');
    const preview = readOptionalContextPreviewTarget(source.preview, 'preview');
    return {
        enabled: readBoolean(source.enabled, 'enabled'),
        mode: readEnumValue(source.mode, 'mode', contextSettingModes),
        percent: readPercentValue(source.percent, 'percent'),
        ...(preview ? { preview } : {}),
    };
}

export function parseSetContextProfileSettingsInput(input: unknown): SetContextProfileSettingsInput {
    const source = readObject(input, 'input');
    const profileId = readProfileId(source);
    const overrideMode = readEnumValue(source.overrideMode, 'overrideMode', contextProfileOverrideModes);
    const percent = readOptionalPercentValue(source.percent, 'percent');
    const fixedInputTokens = readFixedInputTokens(source.fixedInputTokens, 'fixedInputTokens');
    const preview = readOptionalContextPreviewTarget(source.preview, 'preview');

    if (overrideMode === 'percent' && percent === undefined) {
        throw new Error('Invalid "percent": required when overrideMode is "percent".');
    }
    if (overrideMode === 'fixed_tokens' && fixedInputTokens === undefined) {
        throw new Error('Invalid "fixedInputTokens": required when overrideMode is "fixed_tokens".');
    }
    if (overrideMode === 'inherit' && (source.percent !== undefined || source.fixedInputTokens !== undefined)) {
        throw new Error('Invalid profile context override: inherit mode does not accept percent or fixedInputTokens.');
    }

    if (overrideMode === 'percent') {
        if (percent === undefined) {
            throw new Error('Invalid "percent": required when overrideMode is "percent".');
        }
        return {
            profileId,
            overrideMode,
            percent,
            ...(preview ? { preview } : {}),
        };
    }

    if (overrideMode === 'fixed_tokens') {
        if (fixedInputTokens === undefined) {
            throw new Error('Invalid "fixedInputTokens": required when overrideMode is "fixed_tokens".');
        }
        return {
            profileId,
            overrideMode,
            fixedInputTokens,
            ...(preview ? { preview } : {}),
        };
    }

    return {
        profileId,
        overrideMode,
        ...(preview ? { preview } : {}),
    };
}

export function parseResolvedContextStateInput(input: unknown): ResolvedContextStateInput {
    const source = readObject(input, 'input');
    const sessionIdValue = source.sessionId;
    const topLevelTabValue = source.topLevelTab;
    const modeKeyValue = source.modeKey;
    const workspaceFingerprint = readOptionalString(source.workspaceFingerprint, 'workspaceFingerprint');
    const runIdValue = source.runId;
    const parsed: ResolvedContextStateInput = {
        profileId: readProfileId(source),
        providerId: readProviderId(source.providerId, 'providerId'),
        modelId: readString(source.modelId, 'modelId'),
        ...(workspaceFingerprint ? { workspaceFingerprint } : {}),
        ...(runIdValue !== undefined ? { runId: readEntityId(runIdValue, 'runId', 'run') } : {}),
    };

    const hasSessionFields =
        sessionIdValue !== undefined || topLevelTabValue !== undefined || modeKeyValue !== undefined;
    if (!hasSessionFields) {
        return parsed;
    }
    if (sessionIdValue === undefined || topLevelTabValue === undefined || modeKeyValue === undefined) {
        throw new Error('Resolved context state requires sessionId, topLevelTab, and modeKey together.');
    }

    return {
        ...parsed,
        sessionId: readEntityId(sessionIdValue, 'sessionId', 'sess'),
        topLevelTab: readEnumValue(topLevelTabValue, 'topLevelTab', topLevelTabs),
        modeKey: readString(modeKeyValue, 'modeKey'),
    };
}

export function parseCompactSessionInput(input: unknown): CompactSessionInput {
    const source = readObject(input, 'input');
    const workspaceFingerprint = readOptionalString(source.workspaceFingerprint, 'workspaceFingerprint');
    return {
        profileId: readProfileId(source),
        sessionId: readEntityId(source.sessionId, 'sessionId', 'sess'),
        providerId: readProviderId(source.providerId, 'providerId'),
        modelId: readString(source.modelId, 'modelId'),
        topLevelTab: readEnumValue(source.topLevelTab, 'topLevelTab', topLevelTabs),
        modeKey: readString(source.modeKey, 'modeKey'),
        ...(workspaceFingerprint ? { workspaceFingerprint } : {}),
    };
}

export const contextPolicyInputSchema = createParser(parseContextPolicyInput);
export const setContextGlobalSettingsInputSchema = createParser(parseSetContextGlobalSettingsInput);
export const setContextProfileSettingsInputSchema = createParser(parseSetContextProfileSettingsInput);
export const resolvedContextStateInputSchema = createParser(parseResolvedContextStateInput);
export const compactSessionInputSchema = createParser(parseCompactSessionInput);
