import { topLevelTabs } from '@/app/backend/runtime/contracts/enums';
import {
    createParser,
    readBoolean,
    readEnumValue,
    readObject,
    readOptionalString,
    readProfileId,
    readString,
} from '@/app/backend/runtime/contracts/parsers/helpers';
import type {
    PromptLayerExportCustomModeInput,
    PromptLayerGetSettingsInput,
    PromptLayerImportCustomModeInput,
    PromptLayerResetBuiltInModePromptInput,
    PromptLayerResetAppGlobalInstructionsInput,
    PromptLayerResetProfileGlobalInstructionsInput,
    PromptLayerResetTopLevelInstructionsInput,
    PromptLayerSetBuiltInModePromptInput,
    PromptLayerSetAppGlobalInstructionsInput,
    PromptLayerSetProfileGlobalInstructionsInput,
    PromptLayerSetTopLevelInstructionsInput,
    ProfileInput,
} from '@/app/backend/runtime/contracts/types';

function readInstructionValue(value: unknown, field: string): string {
    if (typeof value !== 'string') {
        throw new Error(`Invalid "${field}": expected string.`);
    }

    return value.trim();
}

function parseProfileInput(input: unknown): ProfileInput {
    const source = readObject(input, 'input');
    return {
        profileId: readProfileId(source),
    };
}

function readCustomModeScope(value: unknown, field: string): 'global' | 'workspace' {
    return readEnumValue(value, field, ['global', 'workspace'] as const);
}

function readWorkspaceFingerprintForScope(source: Record<string, unknown>, scope: 'global' | 'workspace'): string | undefined {
    const workspaceFingerprint = readOptionalString(source.workspaceFingerprint, 'workspaceFingerprint');
    if (scope === 'workspace' && !workspaceFingerprint) {
        throw new Error('Invalid "workspaceFingerprint": required when scope is "workspace".');
    }
    if (scope === 'global' && workspaceFingerprint) {
        throw new Error('Invalid "workspaceFingerprint": not allowed when scope is "global".');
    }

    return workspaceFingerprint;
}

export function parsePromptLayerGetSettingsInput(input: unknown): PromptLayerGetSettingsInput {
    const source = readObject(input, 'input');
    const workspaceFingerprint = readOptionalString(source.workspaceFingerprint, 'workspaceFingerprint');

    return {
        profileId: readProfileId(source),
        ...(workspaceFingerprint ? { workspaceFingerprint } : {}),
    };
}

export function parsePromptLayerSetAppGlobalInstructionsInput(input: unknown): PromptLayerSetAppGlobalInstructionsInput {
    const source = readObject(input, 'input');

    return {
        profileId: readProfileId(source),
        value: readInstructionValue(source.value, 'value'),
    };
}

export function parsePromptLayerResetAppGlobalInstructionsInput(
    input: unknown
): PromptLayerResetAppGlobalInstructionsInput {
    return parseProfileInput(input);
}

export function parsePromptLayerSetProfileGlobalInstructionsInput(
    input: unknown
): PromptLayerSetProfileGlobalInstructionsInput {
    const source = readObject(input, 'input');

    return {
        profileId: readProfileId(source),
        value: readInstructionValue(source.value, 'value'),
    };
}

export function parsePromptLayerResetProfileGlobalInstructionsInput(
    input: unknown
): PromptLayerResetProfileGlobalInstructionsInput {
    return parseProfileInput(input);
}

export function parsePromptLayerSetTopLevelInstructionsInput(
    input: unknown
): PromptLayerSetTopLevelInstructionsInput {
    const source = readObject(input, 'input');

    return {
        profileId: readProfileId(source),
        topLevelTab: readEnumValue(source.topLevelTab, 'topLevelTab', topLevelTabs),
        value: readInstructionValue(source.value, 'value'),
    };
}

export function parsePromptLayerResetTopLevelInstructionsInput(
    input: unknown
): PromptLayerResetTopLevelInstructionsInput {
    const source = readObject(input, 'input');

    return {
        profileId: readProfileId(source),
        topLevelTab: readEnumValue(source.topLevelTab, 'topLevelTab', topLevelTabs),
    };
}

export function parsePromptLayerSetBuiltInModePromptInput(input: unknown): PromptLayerSetBuiltInModePromptInput {
    const source = readObject(input, 'input');

    return {
        profileId: readProfileId(source),
        topLevelTab: readEnumValue(source.topLevelTab, 'topLevelTab', topLevelTabs),
        modeKey: readString(source.modeKey, 'modeKey'),
        roleDefinition: readInstructionValue(source.roleDefinition, 'roleDefinition'),
        customInstructions: readInstructionValue(source.customInstructions, 'customInstructions'),
    };
}

export function parsePromptLayerResetBuiltInModePromptInput(
    input: unknown
): PromptLayerResetBuiltInModePromptInput {
    const source = readObject(input, 'input');

    return {
        profileId: readProfileId(source),
        topLevelTab: readEnumValue(source.topLevelTab, 'topLevelTab', topLevelTabs),
        modeKey: readString(source.modeKey, 'modeKey'),
    };
}

export function parsePromptLayerExportCustomModeInput(input: unknown): PromptLayerExportCustomModeInput {
    const source = readObject(input, 'input');
    const scope = readCustomModeScope(source.scope, 'scope');
    const workspaceFingerprint = readWorkspaceFingerprintForScope(source, scope);

    return {
        profileId: readProfileId(source),
        topLevelTab: readEnumValue(source.topLevelTab, 'topLevelTab', topLevelTabs),
        modeKey: readString(source.modeKey, 'modeKey'),
        scope,
        ...(workspaceFingerprint ? { workspaceFingerprint } : {}),
    };
}

export function parsePromptLayerImportCustomModeInput(input: unknown): PromptLayerImportCustomModeInput {
    const source = readObject(input, 'input');
    const scope = readCustomModeScope(source.scope, 'scope');
    const workspaceFingerprint = readWorkspaceFingerprintForScope(source, scope);

    return {
        profileId: readProfileId(source),
        topLevelTab: readEnumValue(source.topLevelTab, 'topLevelTab', topLevelTabs),
        scope,
        ...(workspaceFingerprint ? { workspaceFingerprint } : {}),
        jsonText: readString(source.jsonText, 'jsonText'),
        overwrite: readBoolean(source.overwrite, 'overwrite'),
    };
}

export const promptLayerGetSettingsInputSchema = createParser(parsePromptLayerGetSettingsInput);
export const promptLayerSetAppGlobalInstructionsInputSchema = createParser(parsePromptLayerSetAppGlobalInstructionsInput);
export const promptLayerResetAppGlobalInstructionsInputSchema = createParser(
    parsePromptLayerResetAppGlobalInstructionsInput
);
export const promptLayerSetProfileGlobalInstructionsInputSchema = createParser(
    parsePromptLayerSetProfileGlobalInstructionsInput
);
export const promptLayerResetProfileGlobalInstructionsInputSchema = createParser(
    parsePromptLayerResetProfileGlobalInstructionsInput
);
export const promptLayerSetTopLevelInstructionsInputSchema = createParser(
    parsePromptLayerSetTopLevelInstructionsInput
);
export const promptLayerResetTopLevelInstructionsInputSchema = createParser(
    parsePromptLayerResetTopLevelInstructionsInput
);
export const promptLayerSetBuiltInModePromptInputSchema = createParser(parsePromptLayerSetBuiltInModePromptInput);
export const promptLayerResetBuiltInModePromptInputSchema = createParser(
    parsePromptLayerResetBuiltInModePromptInput
);
export const promptLayerExportCustomModeInputSchema = createParser(parsePromptLayerExportCustomModeInput);
export const promptLayerImportCustomModeInputSchema = createParser(parsePromptLayerImportCustomModeInput);
