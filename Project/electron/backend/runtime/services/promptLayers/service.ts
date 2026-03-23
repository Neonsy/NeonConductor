import path from 'node:path';

import { appPromptLayerSettingsStore, builtInModePromptOverrideStore, modeStore, settingsStore } from '@/app/backend/persistence/stores';
import {
    type FileBackedCustomModeSettingsItem,
    normalizeModePromptDefinition,
    topLevelTabs,
    type BuiltInModePromptSettingsItem,
    type ModeDefinition,
    type PromptLayerExportCustomModeResult,
    type PromptLayerSettings,
    type TopLevelTab,
} from '@/app/backend/runtime/contracts';
import { buildDiscoveredAssets, replaceDiscoveredModes } from '@/app/backend/runtime/services/registry/discovery';
import { resolveRegistryPaths } from '@/app/backend/runtime/services/registry/filesystem';

import {
    fileExists,
    parsePortableCustomModeJson,
    renderPortableModeMarkdown,
    resolveCustomModeDirectory,
    toPortableModePayload,
    writePortableModeFile,
} from '@/app/backend/runtime/services/promptLayers/customModePortability';

const PROFILE_GLOBAL_INSTRUCTIONS_KEY = 'prompt_layer.profile_global_instructions';
const TOP_LEVEL_INSTRUCTIONS_KEY_PREFIX = 'prompt_layer.top_level.';
const BUILT_IN_MODE_ORDER: Record<TopLevelTab, string[]> = {
    chat: ['chat'],
    agent: ['plan', 'ask', 'code', 'debug'],
    orchestrator: ['plan', 'orchestrate', 'debug'],
};

function normalizeInstructions(value: string | undefined): string {
    return value?.trim() ?? '';
}

function getTopLevelInstructionsKey(topLevelTab: TopLevelTab): string {
    return `${TOP_LEVEL_INSTRUCTIONS_KEY_PREFIX}${topLevelTab}`;
}

function isBuiltInMode(mode: Pick<ModeDefinition, 'scope' | 'sourceKind'>): boolean {
    return mode.scope === 'system' && mode.sourceKind === 'system_seed';
}

function sortBuiltInModes(left: BuiltInModePromptSettingsItem, right: BuiltInModePromptSettingsItem): number {
    const order = BUILT_IN_MODE_ORDER[left.topLevelTab];
    return order.indexOf(left.modeKey) - order.indexOf(right.modeKey);
}

function createEmptyCustomModeGroups(): Record<TopLevelTab, FileBackedCustomModeSettingsItem[]> {
    return {
        chat: [],
        agent: [],
        orchestrator: [],
    };
}

function sortFileBackedCustomModes(
    left: FileBackedCustomModeSettingsItem,
    right: FileBackedCustomModeSettingsItem
): number {
    return left.label.localeCompare(right.label) || left.modeKey.localeCompare(right.modeKey);
}

async function readFileBackedCustomModes(input: {
    profileId: string;
    workspaceFingerprint?: string;
}): Promise<PromptLayerSettings['fileBackedCustomModes']> {
    const storedModes = await modeStore.listByProfile(input.profileId);
    const globalModes = createEmptyCustomModeGroups();
    const workspaceModes = createEmptyCustomModeGroups();

    for (const mode of storedModes) {
        if (mode.scope === 'system' || mode.sourceKind === 'system_seed' || mode.scope === 'session') {
            continue;
        }
        if (mode.sourceKind !== 'global_file' && mode.sourceKind !== 'workspace_file') {
            continue;
        }
        if (mode.scope === 'workspace' && mode.workspaceFingerprint !== input.workspaceFingerprint) {
            continue;
        }

        const item: FileBackedCustomModeSettingsItem = {
            topLevelTab: mode.topLevelTab,
            modeKey: mode.modeKey,
            label: mode.label,
            ...(mode.description ? { description: mode.description } : {}),
            ...(mode.whenToUse ? { whenToUse: mode.whenToUse } : {}),
            ...(mode.groups ? { groups: mode.groups } : {}),
        };
        if (mode.scope === 'workspace') {
            workspaceModes[mode.topLevelTab].push(item);
            continue;
        }

        globalModes[mode.topLevelTab].push(item);
    }

    for (const topLevelTab of topLevelTabs) {
        globalModes[topLevelTab].sort(sortFileBackedCustomModes);
        workspaceModes[topLevelTab].sort(sortFileBackedCustomModes);
    }

    return {
        global: globalModes,
        ...(input.workspaceFingerprint ? { workspace: workspaceModes } : {}),
    };
}

async function readPromptLayerSettings(input: {
    profileId: string;
    workspaceFingerprint?: string;
}): Promise<PromptLayerSettings> {
    const [appSettings, profileGlobalInstructions, topLevelInstructions, builtInModes, fileBackedCustomModes] =
        await Promise.all([
            appPromptLayerSettingsStore.get(),
            settingsStore.getStringOptional(input.profileId, PROFILE_GLOBAL_INSTRUCTIONS_KEY),
            readTopLevelInstructions(input.profileId),
            readBuiltInModes(input.profileId),
            readFileBackedCustomModes(input),
        ]);

    return {
        appGlobalInstructions: normalizeInstructions(appSettings.globalInstructions),
        profileGlobalInstructions: normalizeInstructions(profileGlobalInstructions),
        topLevelInstructions,
        builtInModes,
        fileBackedCustomModes,
    };
}

async function findFileBackedCustomMode(input: {
    profileId: string;
    topLevelTab: TopLevelTab;
    modeKey: string;
    scope: 'global' | 'workspace';
    workspaceFingerprint?: string;
}): Promise<ModeDefinition | undefined> {
    const storedModes = await modeStore.listByProfile(input.profileId);
    return storedModes.find(
        (mode) =>
            mode.topLevelTab === input.topLevelTab &&
            mode.modeKey === input.modeKey &&
            mode.scope === input.scope &&
            mode.sourceKind === (input.scope === 'global' ? 'global_file' : 'workspace_file') &&
            (input.scope !== 'workspace' || mode.workspaceFingerprint === input.workspaceFingerprint)
    );
}

async function refreshDiscoveredModesForScope(input: {
    profileId: string;
    scope: 'global' | 'workspace';
    workspaceFingerprint?: string;
}): Promise<void> {
    const paths = await resolveRegistryPaths({
        profileId: input.profileId,
        ...(input.workspaceFingerprint ? { workspaceFingerprint: input.workspaceFingerprint } : {}),
    });
    const rootPath =
        input.scope === 'workspace'
            ? paths.workspaceAssetsRoot
            : paths.globalAssetsRoot;
    if (!rootPath) {
        throw new Error('Workspace mode import requires a selected workspace.');
    }

    const discoveredAssets = await buildDiscoveredAssets({
        rootPath,
        scope: input.scope,
        ...(input.workspaceFingerprint ? { workspaceFingerprint: input.workspaceFingerprint } : {}),
    });
    await replaceDiscoveredModes({
        profileId: input.profileId,
        scope: input.scope,
        ...(input.workspaceFingerprint ? { workspaceFingerprint: input.workspaceFingerprint } : {}),
        modes: discoveredAssets.modes,
    });
}

async function readBuiltInModes(profileId: string): Promise<Record<TopLevelTab, BuiltInModePromptSettingsItem[]>> {
    const [storedModes, overrides] = await Promise.all([
        modeStore.listByProfile(profileId),
        builtInModePromptOverrideStore.listByProfile(profileId),
    ]);
    const overrideByKey = new Map(
        overrides.map((override) => [`${override.topLevelTab}:${override.modeKey}`, override] as const)
    );

    const builtInModes = storedModes
        .filter(isBuiltInMode)
        .map((mode) => {
            const override = overrideByKey.get(`${mode.topLevelTab}:${mode.modeKey}`);
            return {
                topLevelTab: mode.topLevelTab,
                modeKey: mode.modeKey,
                label: mode.label,
                prompt: override ? normalizeModePromptDefinition({ ...mode.prompt, ...override.prompt }) : mode.prompt,
                hasOverride: override !== undefined,
            } satisfies BuiltInModePromptSettingsItem;
        });

    return {
        chat: builtInModes.filter((mode) => mode.topLevelTab === 'chat').sort(sortBuiltInModes),
        agent: builtInModes.filter((mode) => mode.topLevelTab === 'agent').sort(sortBuiltInModes),
        orchestrator: builtInModes.filter((mode) => mode.topLevelTab === 'orchestrator').sort(sortBuiltInModes),
    };
}

async function assertBuiltInModeExists(profileId: string, topLevelTab: TopLevelTab, modeKey: string): Promise<void> {
    const builtInModes = await modeStore.listByProfile(profileId);
    const builtInMode = builtInModes.find(
        (mode) => mode.topLevelTab === topLevelTab && mode.modeKey === modeKey && isBuiltInMode(mode)
    );
    if (!builtInMode) {
        throw new Error(`Built-in mode "${topLevelTab}:${modeKey}" was not found.`);
    }
}

async function readTopLevelInstructions(profileId: string): Promise<Record<TopLevelTab, string>> {
    const storedInstructions = await Promise.all(
        topLevelTabs.map(async (topLevelTab) => {
            const storedValue = await settingsStore.getStringOptional(profileId, getTopLevelInstructionsKey(topLevelTab));
            return [topLevelTab, normalizeInstructions(storedValue)] as const;
        })
    );

    return Object.fromEntries(storedInstructions) as Record<TopLevelTab, string>;
}

export async function getPromptLayerSettings(
    profileId: string,
    workspaceFingerprint?: string
): Promise<PromptLayerSettings> {
    return readPromptLayerSettings({
        profileId,
        ...(workspaceFingerprint ? { workspaceFingerprint } : {}),
    });
}

export async function setAppGlobalInstructions(input: {
    profileId: string;
    value: string;
}): Promise<PromptLayerSettings> {
    const normalizedValue = normalizeInstructions(input.value);
    await appPromptLayerSettingsStore.setGlobalInstructions(normalizedValue);
    return getPromptLayerSettings(input.profileId);
}

export async function resetAppGlobalInstructions(profileId: string): Promise<PromptLayerSettings> {
    await appPromptLayerSettingsStore.setGlobalInstructions('');
    return getPromptLayerSettings(profileId);
}

export async function setProfileGlobalInstructions(input: {
    profileId: string;
    value: string;
}): Promise<PromptLayerSettings> {
    const normalizedValue = normalizeInstructions(input.value);
    if (normalizedValue.length === 0) {
        await settingsStore.delete(input.profileId, PROFILE_GLOBAL_INSTRUCTIONS_KEY);
    } else {
        await settingsStore.setString(input.profileId, PROFILE_GLOBAL_INSTRUCTIONS_KEY, normalizedValue);
    }

    return getPromptLayerSettings(input.profileId);
}

export async function resetProfileGlobalInstructions(profileId: string): Promise<PromptLayerSettings> {
    await settingsStore.delete(profileId, PROFILE_GLOBAL_INSTRUCTIONS_KEY);
    return getPromptLayerSettings(profileId);
}

export async function setTopLevelInstructions(input: {
    profileId: string;
    topLevelTab: TopLevelTab;
    value: string;
}): Promise<PromptLayerSettings> {
    const normalizedValue = normalizeInstructions(input.value);
    const key = getTopLevelInstructionsKey(input.topLevelTab);

    if (normalizedValue.length === 0) {
        await settingsStore.delete(input.profileId, key);
    } else {
        await settingsStore.setString(input.profileId, key, normalizedValue);
    }

    return getPromptLayerSettings(input.profileId);
}

export async function resetTopLevelInstructions(input: {
    profileId: string;
    topLevelTab: TopLevelTab;
}): Promise<PromptLayerSettings> {
    await settingsStore.delete(input.profileId, getTopLevelInstructionsKey(input.topLevelTab));
    return getPromptLayerSettings(input.profileId);
}

export async function setBuiltInModePrompt(input: {
    profileId: string;
    topLevelTab: TopLevelTab;
    modeKey: string;
    roleDefinition: string;
    customInstructions: string;
}): Promise<PromptLayerSettings> {
    await assertBuiltInModeExists(input.profileId, input.topLevelTab, input.modeKey);
    const normalizedPrompt = normalizeModePromptDefinition({
        roleDefinition: input.roleDefinition,
        customInstructions: input.customInstructions,
    });
    if (Object.keys(normalizedPrompt).length === 0) {
        await builtInModePromptOverrideStore.delete(input.profileId, input.topLevelTab, input.modeKey);
    } else {
        await builtInModePromptOverrideStore.setPrompt({
            profileId: input.profileId,
            topLevelTab: input.topLevelTab,
            modeKey: input.modeKey,
            prompt: normalizedPrompt,
        });
    }

    return getPromptLayerSettings(input.profileId);
}

export async function resetBuiltInModePrompt(input: {
    profileId: string;
    topLevelTab: TopLevelTab;
    modeKey: string;
}): Promise<PromptLayerSettings> {
    await assertBuiltInModeExists(input.profileId, input.topLevelTab, input.modeKey);
    await builtInModePromptOverrideStore.delete(input.profileId, input.topLevelTab, input.modeKey);
    return getPromptLayerSettings(input.profileId);
}

export async function exportCustomMode(input: {
    profileId: string;
    topLevelTab: TopLevelTab;
    modeKey: string;
    scope: 'global' | 'workspace';
    workspaceFingerprint?: string;
}): Promise<PromptLayerExportCustomModeResult> {
    const mode = await findFileBackedCustomMode(input);
    if (!mode) {
        throw new Error(`File-backed custom mode "${input.topLevelTab}:${input.modeKey}" was not found.`);
    }

    return {
        modeKey: mode.modeKey,
        scope: input.scope,
        jsonText: JSON.stringify(toPortableModePayload(mode), null, 2),
    };
}

export async function importCustomMode(input: {
    profileId: string;
    topLevelTab: TopLevelTab;
    scope: 'global' | 'workspace';
    workspaceFingerprint?: string;
    jsonText: string;
    overwrite: boolean;
}): Promise<PromptLayerSettings> {
    const payload = parsePortableCustomModeJson(input.jsonText);
    const { modeKey, fileContent } = renderPortableModeMarkdown({
        topLevelTab: input.topLevelTab,
        payload,
    });
    const existingMode = await findFileBackedCustomMode({
        profileId: input.profileId,
        topLevelTab: input.topLevelTab,
        modeKey,
        scope: input.scope,
        ...(input.workspaceFingerprint ? { workspaceFingerprint: input.workspaceFingerprint } : {}),
    });
    const directory = await resolveCustomModeDirectory({
        profileId: input.profileId,
        scope: input.scope,
        ...(input.workspaceFingerprint ? { workspaceFingerprint: input.workspaceFingerprint } : {}),
    });
    const absolutePath =
        existingMode?.originPath ?? path.join(directory, `${input.topLevelTab}-${modeKey}.md`);
    const exists = existingMode !== undefined || (await fileExists(absolutePath));
    if (exists && !input.overwrite) {
        throw new Error(
            `A ${input.scope} file-backed mode already exists for "${input.topLevelTab}:${modeKey}". Re-run with overwrite confirmation to replace it.`
        );
    }

    await writePortableModeFile({
        absolutePath,
        fileContent,
    });
    await refreshDiscoveredModesForScope({
        profileId: input.profileId,
        scope: input.scope,
        ...(input.workspaceFingerprint ? { workspaceFingerprint: input.workspaceFingerprint } : {}),
    });

    return getPromptLayerSettings(input.profileId, input.workspaceFingerprint);
}
