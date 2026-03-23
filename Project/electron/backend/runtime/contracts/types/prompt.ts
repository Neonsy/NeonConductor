import type { TopLevelTab } from '@/app/backend/runtime/contracts/enums';
import type { ModePromptDefinition } from '@/app/backend/runtime/contracts/types/mode';
import type { ProfileInput } from '@/app/backend/runtime/contracts/types/common';

export interface FileBackedCustomModeSettingsItem {
    topLevelTab: TopLevelTab;
    modeKey: string;
    label: string;
    description?: string;
}

export interface FileBackedCustomModeSettingsByScope {
    global: Record<TopLevelTab, FileBackedCustomModeSettingsItem[]>;
    workspace?: Record<TopLevelTab, FileBackedCustomModeSettingsItem[]>;
}

export interface BuiltInModePromptSettingsItem {
    topLevelTab: TopLevelTab;
    modeKey: string;
    label: string;
    prompt: ModePromptDefinition;
    hasOverride: boolean;
}

export interface PromptLayerSettings {
    appGlobalInstructions: string;
    profileGlobalInstructions: string;
    topLevelInstructions: Record<TopLevelTab, string>;
    builtInModes: Record<TopLevelTab, BuiltInModePromptSettingsItem[]>;
    fileBackedCustomModes: FileBackedCustomModeSettingsByScope;
}

export interface PromptLayerGetSettingsInput extends ProfileInput {
    workspaceFingerprint?: string;
}

export interface PromptLayerSetAppGlobalInstructionsInput extends ProfileInput {
    value: string;
}

export type PromptLayerResetAppGlobalInstructionsInput = ProfileInput;

export interface PromptLayerSetProfileGlobalInstructionsInput extends ProfileInput {
    value: string;
}

export type PromptLayerResetProfileGlobalInstructionsInput = ProfileInput;

export interface PromptLayerSetTopLevelInstructionsInput extends ProfileInput {
    topLevelTab: TopLevelTab;
    value: string;
}

export interface PromptLayerResetTopLevelInstructionsInput extends ProfileInput {
    topLevelTab: TopLevelTab;
}

export interface PromptLayerSetBuiltInModePromptInput extends ProfileInput {
    topLevelTab: TopLevelTab;
    modeKey: string;
    roleDefinition: string;
    customInstructions: string;
}

export interface PromptLayerResetBuiltInModePromptInput extends ProfileInput {
    topLevelTab: TopLevelTab;
    modeKey: string;
}

export interface PromptLayerExportCustomModeInput extends ProfileInput {
    topLevelTab: TopLevelTab;
    modeKey: string;
    scope: 'global' | 'workspace';
    workspaceFingerprint?: string;
}

export interface PromptLayerImportCustomModeInput extends ProfileInput {
    topLevelTab: TopLevelTab;
    scope: 'global' | 'workspace';
    workspaceFingerprint?: string;
    jsonText: string;
    overwrite: boolean;
}

export interface PromptLayerExportCustomModeResult {
    modeKey: string;
    scope: 'global' | 'workspace';
    jsonText: string;
}
