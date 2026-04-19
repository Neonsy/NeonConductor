import type { InternalModelRole, ModeAuthoringRole, ModeRoleTemplateKey, TopLevelTab } from '@/app/backend/runtime/contracts/enums';
import type { ProfileInput } from '@/app/backend/runtime/contracts/types/common';
import type { ModePromptDefinition } from '@/app/backend/runtime/contracts/types/mode';

import type {
    BehaviorFlag,
    RuntimeRequirementProfile,
    ToolCapability,
    WorkflowCapability,
} from '@/shared/contracts';

export interface FileBackedCustomModeSettingsItem {
    topLevelTab: TopLevelTab;
    modeKey: string;
    label: string;
    authoringRole: ModeAuthoringRole;
    roleTemplate: ModeRoleTemplateKey;
    internalModelRole: InternalModelRole;
    delegatedOnly: boolean;
    sessionSelectable: boolean;
    description?: string;
    whenToUse?: string;
    tags?: string[];
    toolCapabilities?: ToolCapability[];
    workflowCapabilities?: WorkflowCapability[];
    behaviorFlags?: BehaviorFlag[];
    runtimeProfile?: RuntimeRequirementProfile;
}

export interface FileBackedCustomModeSettingsByScope {
    global: Record<TopLevelTab, FileBackedCustomModeSettingsItem[]>;
    workspace?: Record<TopLevelTab, FileBackedCustomModeSettingsItem[]>;
}

export interface DelegatedCustomModeSettingsByScope {
    global: FileBackedCustomModeSettingsItem[];
    workspace?: FileBackedCustomModeSettingsItem[];
}

export interface BuiltInModePromptSettingsItem {
    topLevelTab: TopLevelTab;
    modeKey: string;
    label: string;
    prompt: ModePromptDefinition;
    hasOverride: boolean;
    authoringRole: ModeAuthoringRole;
    roleTemplate: ModeRoleTemplateKey;
    internalModelRole: InternalModelRole;
    toolCapabilities?: ToolCapability[];
    workflowCapabilities?: WorkflowCapability[];
    behaviorFlags?: BehaviorFlag[];
    runtimeProfile?: RuntimeRequirementProfile;
}

export type ModeDraftSourceKind =
    | 'manual'
    | 'portable_json_v1'
    | 'portable_json_v2'
    | 'pasted_source_material';

export type ModeDraftValidationState = 'unvalidated' | 'valid' | 'invalid';

export interface PromptLayerModeDraftPayload {
    topLevelTab?: TopLevelTab;
    slug?: string;
    name?: string;
    authoringRole?: ModeAuthoringRole;
    roleTemplate?: ModeRoleTemplateKey;
    description?: string;
    roleDefinition?: string;
    customInstructions?: string;
    whenToUse?: string;
    tags?: string[];
}

export interface ModeDraftRecord {
    id: string;
    profileId: string;
    scope: 'global' | 'workspace';
    workspaceFingerprint?: string;
    sourceKind: ModeDraftSourceKind;
    sourceText?: string;
    mode: PromptLayerModeDraftPayload;
    validationState: ModeDraftValidationState;
    validationErrors: string[];
    createdAt: string;
    updatedAt: string;
}

export interface PromptLayerSettings {
    appGlobalInstructions: string;
    profileGlobalInstructions: string;
    topLevelInstructions: Record<TopLevelTab, string>;
    builtInModes: Record<TopLevelTab, BuiltInModePromptSettingsItem[]>;
    fileBackedCustomModes: FileBackedCustomModeSettingsByScope;
    delegatedWorkerModes: DelegatedCustomModeSettingsByScope;
    modeDrafts: ModeDraftRecord[];
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

export interface PromptLayerCustomModePayload {
    slug: string;
    name: string;
    authoringRole: ModeAuthoringRole;
    roleTemplate: ModeRoleTemplateKey;
    description?: string;
    roleDefinition?: string;
    customInstructions?: string;
    whenToUse?: string;
    tags?: string[];
}

export interface PromptLayerEditableCustomModePayload {
    name: string;
    authoringRole: ModeAuthoringRole;
    roleTemplate: ModeRoleTemplateKey;
    description?: string;
    roleDefinition?: string;
    customInstructions?: string;
    whenToUse?: string;
    tags?: string[];
}

export interface PromptLayerCustomModeRecord {
    scope: 'global' | 'workspace';
    topLevelTab: TopLevelTab;
    modeKey: string;
    slug: string;
    name: string;
    authoringRole: ModeAuthoringRole;
    roleTemplate: ModeRoleTemplateKey;
    internalModelRole: InternalModelRole;
    delegatedOnly: boolean;
    sessionSelectable: boolean;
    description?: string;
    roleDefinition?: string;
    customInstructions?: string;
    whenToUse?: string;
    tags?: string[];
    toolCapabilities?: ToolCapability[];
    workflowCapabilities?: WorkflowCapability[];
    behaviorFlags?: BehaviorFlag[];
    runtimeProfile?: RuntimeRequirementProfile;
}

export interface PromptLayerGetCustomModeInput extends ProfileInput {
    topLevelTab: TopLevelTab;
    modeKey: string;
    scope: 'global' | 'workspace';
    workspaceFingerprint?: string;
}

export interface PromptLayerCreateCustomModeInput extends ProfileInput {
    topLevelTab: TopLevelTab;
    scope: 'global' | 'workspace';
    workspaceFingerprint?: string;
    mode: PromptLayerCustomModePayload;
}

export interface PromptLayerUpdateCustomModeInput extends ProfileInput {
    topLevelTab: TopLevelTab;
    modeKey: string;
    scope: 'global' | 'workspace';
    workspaceFingerprint?: string;
    mode: PromptLayerEditableCustomModePayload;
}

export interface PromptLayerDeleteCustomModeInput extends ProfileInput {
    topLevelTab: TopLevelTab;
    modeKey: string;
    scope: 'global' | 'workspace';
    workspaceFingerprint?: string;
    confirm: boolean;
}

export interface PromptLayerImportCustomModeInput extends ProfileInput {
    scope: 'global' | 'workspace';
    workspaceFingerprint?: string;
    jsonText: string;
    topLevelTab?: TopLevelTab;
}

export interface PromptLayerExportCustomModeResult {
    modeKey: string;
    scope: 'global' | 'workspace';
    jsonText: string;
}

export interface PromptLayerCreateModeDraftInput extends ProfileInput {
    scope: 'global' | 'workspace';
    workspaceFingerprint?: string;
    sourceKind: ModeDraftSourceKind;
    sourceText?: string;
    mode: PromptLayerModeDraftPayload;
}

export interface PromptLayerUpdateModeDraftInput extends ProfileInput {
    draftId: string;
    mode: PromptLayerModeDraftPayload;
    sourceText?: string;
}

export interface PromptLayerValidateModeDraftInput extends ProfileInput {
    draftId: string;
}

export interface PromptLayerApplyModeDraftInput extends ProfileInput {
    draftId: string;
    overwrite: boolean;
}

export interface PromptLayerDiscardModeDraftInput extends ProfileInput {
    draftId: string;
}
