import { topLevelTabs } from '@/app/backend/runtime/contracts/enums';
import type { ModeGetActiveInput, ModeListInput, ModeSetActiveInput } from '@/app/backend/runtime/contracts/types';
import {
    createParser,
    readEnumValue,
    readObject,
    readOptionalString,
    readProfileId,
    readString,
} from '@/app/backend/runtime/contracts/parsers/helpers';

export function parseModeListInput(input: unknown): ModeListInput {
    const source = readObject(input, 'input');
    return {
        profileId: readProfileId(source),
        topLevelTab: readEnumValue(source.topLevelTab, 'topLevelTab', topLevelTabs),
    };
}

export function parseModeGetActiveInput(input: unknown): ModeGetActiveInput {
    const source = readObject(input, 'input');
    const workspaceFingerprint = readOptionalString(source.workspaceFingerprint, 'workspaceFingerprint');

    return {
        profileId: readProfileId(source),
        topLevelTab: readEnumValue(source.topLevelTab, 'topLevelTab', topLevelTabs),
        ...(workspaceFingerprint ? { workspaceFingerprint } : {}),
    };
}

export function parseModeSetActiveInput(input: unknown): ModeSetActiveInput {
    const source = readObject(input, 'input');
    const workspaceFingerprint = readOptionalString(source.workspaceFingerprint, 'workspaceFingerprint');

    return {
        profileId: readProfileId(source),
        topLevelTab: readEnumValue(source.topLevelTab, 'topLevelTab', topLevelTabs),
        modeKey: readString(source.modeKey, 'modeKey'),
        ...(workspaceFingerprint ? { workspaceFingerprint } : {}),
    };
}

export const modeListInputSchema = createParser(parseModeListInput);
export const modeGetActiveInputSchema = createParser(parseModeGetActiveInput);
export const modeSetActiveInputSchema = createParser(parseModeSetActiveInput);
