import { topLevelTabs } from '@/app/backend/runtime/contracts/enums';
import {
    createParser,
    readEnumValue,
    readObject,
    readProfileId,
} from '@/app/backend/runtime/contracts/parsers/helpers';
import type {
    PromptLayerGetSettingsInput,
    PromptLayerResetAppGlobalInstructionsInput,
    PromptLayerResetProfileGlobalInstructionsInput,
    PromptLayerResetTopLevelInstructionsInput,
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

export function parsePromptLayerGetSettingsInput(input: unknown): PromptLayerGetSettingsInput {
    return parseProfileInput(input);
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
