import { appPromptLayerSettingsStore, builtInModePromptOverrideStore, modeStore, settingsStore } from '@/app/backend/persistence/stores';
import {
    normalizeModePromptDefinition,
    topLevelTabs,
    type BuiltInModePromptSettingsItem,
    type ModeDefinition,
    type PromptLayerSettings,
    type TopLevelTab,
} from '@/app/backend/runtime/contracts';

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

export async function getPromptLayerSettings(profileId: string): Promise<PromptLayerSettings> {
    const [appSettings, profileGlobalInstructions, topLevelInstructions, builtInModes] = await Promise.all([
        appPromptLayerSettingsStore.get(),
        settingsStore.getStringOptional(profileId, PROFILE_GLOBAL_INSTRUCTIONS_KEY),
        readTopLevelInstructions(profileId),
        readBuiltInModes(profileId),
    ]);

    return {
        appGlobalInstructions: normalizeInstructions(appSettings.globalInstructions),
        profileGlobalInstructions: normalizeInstructions(profileGlobalInstructions),
        topLevelInstructions,
        builtInModes,
    };
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
