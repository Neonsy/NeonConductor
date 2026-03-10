import {
    createParser,
    readBoolean,
    readEnumValue,
    readObject,
    readOptionalNumber,
    readString,
} from '@/app/backend/runtime/contracts/parsers/helpers';
import { reportRendererBootStatus } from '@/app/main/window/bootCoordinator';
import {
    bootBlockingPrerequisites,
    bootStages,
    bootStatusSources,
    type BootStatusSnapshot,
} from '@/app/shared/splashContract';

import type { BrowserWindow } from 'electron';

export function parseBootStatusSnapshot(input: unknown): BootStatusSnapshot {
    const source = readObject(input, 'input');
    const blockingPrerequisiteValue = source.blockingPrerequisite;
    return {
        stage: readEnumValue(source.stage, 'stage', bootStages),
        headline: readString(source.headline, 'headline'),
        detail: readString(source.detail, 'detail'),
        isStuck: readBoolean(source.isStuck, 'isStuck'),
        blockingPrerequisite:
            blockingPrerequisiteValue === null
                ? null
                : blockingPrerequisiteValue === undefined
                  ? null
                  : readEnumValue(blockingPrerequisiteValue, 'blockingPrerequisite', bootBlockingPrerequisites),
        elapsedMs: readOptionalNumber(source.elapsedMs, 'elapsedMs') ?? 0,
        source: readEnumValue(source.source, 'source', bootStatusSources),
    };
}

export const bootStatusInputSchema = createParser(parseBootStatusSnapshot);

export function reportBootStatus(win: BrowserWindow | null, input: unknown): { accepted: boolean } {
    const status = parseBootStatusSnapshot(input);
    return reportRendererBootStatus(win, status);
}
