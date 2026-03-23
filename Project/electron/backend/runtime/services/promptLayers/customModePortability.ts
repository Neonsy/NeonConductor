import { access, mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { ModeDefinitionRecord } from '@/app/backend/persistence/types';
import { slugifyAssetKey, resolveRegistryPaths } from '@/app/backend/runtime/services/registry/filesystem';

import type { TopLevelTab } from '@/app/backend/runtime/contracts';

export interface PortableCustomModePayload {
    slug: string;
    name: string;
    description?: string;
    roleDefinition?: string;
    customInstructions?: string;
    whenToUse?: string;
    groups?: string[];
}

const portableModeAllowedKeys = new Set([
    'slug',
    'name',
    'description',
    'roleDefinition',
    'customInstructions',
    'whenToUse',
    'groups',
]);

const portableModeUnsupportedKeys = new Set(['topLevelTab']);

function readOptionalPortableString(value: unknown, field: keyof PortableCustomModePayload): string | undefined {
    if (value === undefined) {
        return undefined;
    }
    if (typeof value !== 'string') {
        throw new Error(`Invalid "${field}": expected string.`);
    }

    return value.trim().length > 0 ? value.replace(/\r\n?/g, '\n').trim() : undefined;
}

function readOptionalPortableStringArray(value: unknown, field: 'groups'): string[] | undefined {
    if (value === undefined) {
        return undefined;
    }
    if (!Array.isArray(value)) {
        throw new Error(`Invalid "${field}": expected string array.`);
    }

    const items = value.map((item) => {
        if (typeof item !== 'string') {
            throw new Error(`Invalid "${field}": expected string array.`);
        }

        return item.trim();
    });
    const filteredItems = items.filter((item) => item.length > 0);
    return filteredItems.length > 0 ? Array.from(new Set(filteredItems)) : undefined;
}

export function parsePortableCustomModeJson(jsonText: string): PortableCustomModePayload {
    let parsed: unknown;
    try {
        parsed = JSON.parse(jsonText);
    } catch (error) {
        throw new Error(`Invalid custom mode JSON: ${(error as Error).message}`);
    }

    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Invalid custom mode JSON: expected object.');
    }

    const source = parsed as Record<string, unknown>;
    for (const key of Object.keys(source)) {
        if (portableModeUnsupportedKeys.has(key)) {
            throw new Error(`Unsupported custom mode field "${key}" is not supported in this slice.`);
        }
        if (!portableModeAllowedKeys.has(key)) {
            throw new Error(`Invalid custom mode field "${key}".`);
        }
    }

    const slug = readOptionalPortableString(source.slug, 'slug');
    if (!slug) {
        throw new Error('Invalid "slug": expected non-empty string.');
    }
    const name = readOptionalPortableString(source.name, 'name');
    if (!name) {
        throw new Error('Invalid "name": expected non-empty string.');
    }

    const description = readOptionalPortableString(source.description, 'description');
    const roleDefinition = readOptionalPortableString(source.roleDefinition, 'roleDefinition');
    const customInstructions = readOptionalPortableString(source.customInstructions, 'customInstructions');
    const whenToUse = readOptionalPortableString(source.whenToUse, 'whenToUse');
    const groups = readOptionalPortableStringArray(source.groups, 'groups');

    return {
        slug,
        name,
        ...(description ? { description } : {}),
        ...(roleDefinition ? { roleDefinition } : {}),
        ...(customInstructions ? { customInstructions } : {}),
        ...(whenToUse ? { whenToUse } : {}),
        ...(groups ? { groups } : {}),
    };
}

export function toPortableModePayload(mode: ModeDefinitionRecord): PortableCustomModePayload {
    return {
        slug: mode.modeKey,
        name: mode.label,
        ...(mode.description ? { description: mode.description } : {}),
        ...(mode.prompt.roleDefinition ? { roleDefinition: mode.prompt.roleDefinition } : {}),
        ...(mode.prompt.customInstructions ? { customInstructions: mode.prompt.customInstructions } : {}),
        ...(mode.whenToUse ? { whenToUse: mode.whenToUse } : {}),
        ...(mode.groups ? { groups: mode.groups } : {}),
    };
}

function stringifyFrontmatterValue(value: string): string {
    return JSON.stringify(value.replace(/\r\n?/g, '\n'));
}

export function renderPortableModeMarkdown(input: {
    topLevelTab: TopLevelTab;
    payload: PortableCustomModePayload;
}): { modeKey: string; fileContent: string } {
    const modeKey = slugifyAssetKey(input.payload.slug).replace(/\//g, '_');
    if (modeKey.length === 0) {
        throw new Error('Invalid "slug": could not derive a file-backed mode key.');
    }

    const lines = [
        '---',
        `topLevelTab: ${input.topLevelTab}`,
        `modeKey: ${modeKey}`,
        `label: ${stringifyFrontmatterValue(input.payload.name)}`,
        ...(input.payload.description
            ? [`description: ${stringifyFrontmatterValue(input.payload.description)}`]
            : []),
        ...(input.payload.whenToUse ? [`whenToUse: ${stringifyFrontmatterValue(input.payload.whenToUse)}`] : []),
        ...(input.payload.groups ? ['groups:', ...input.payload.groups.map((group) => `  - ${stringifyFrontmatterValue(group)}`)] : []),
        ...(input.payload.roleDefinition
            ? [`roleDefinition: ${stringifyFrontmatterValue(input.payload.roleDefinition)}`]
            : []),
        '---',
    ];
    const body = input.payload.customInstructions?.replace(/\r\n?/g, '\n').trim() ?? '';

    return {
        modeKey,
        fileContent: body.length > 0 ? `${lines.join('\n')}\n${body}\n` : `${lines.join('\n')}\n`,
    };
}

export async function resolveCustomModeDirectory(input: {
    profileId: string;
    scope: 'global' | 'workspace';
    workspaceFingerprint?: string;
}): Promise<string> {
    const paths = await resolveRegistryPaths({
        profileId: input.profileId,
        ...(input.workspaceFingerprint ? { workspaceFingerprint: input.workspaceFingerprint } : {}),
    });

    if (input.scope === 'workspace') {
        if (!paths.workspaceAssetsRoot || !input.workspaceFingerprint) {
            throw new Error('Workspace mode import requires a selected workspace.');
        }

        const directory = path.join(paths.workspaceAssetsRoot, 'modes');
        await mkdir(directory, { recursive: true });
        return directory;
    }

    const directory = path.join(paths.globalAssetsRoot, 'modes');
    await mkdir(directory, { recursive: true });
    return directory;
}

export async function writePortableModeFile(input: {
    absolutePath: string;
    fileContent: string;
}): Promise<void> {
    const directory = path.dirname(input.absolutePath);
    await mkdir(directory, { recursive: true });
    const tempPath = `${input.absolutePath}.tmp`;
    await writeFile(tempPath, input.fileContent, 'utf8');
    await rename(tempPath, input.absolutePath);
}

export async function fileExists(absolutePath: string): Promise<boolean> {
    try {
        await access(absolutePath);
        return true;
    } catch {
        return false;
    }
}
