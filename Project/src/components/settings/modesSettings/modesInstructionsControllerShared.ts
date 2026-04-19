import type {
    BuiltInToolMetadataEntry,
    BuiltInModePromptSettingsItem,
    FileBackedCustomModeSettingsItem,
    ModeAuthoringRole,
    ModeDraftRecord,
    ModeRoleTemplateKey,
    RuntimeRequirementProfile,
    TopLevelTab,
} from '@/shared/contracts';
import { listModeRoleTemplateDefinitions } from '@/shared/modeRoleCatalog';

export type FileBackedModeItemsByTab = Record<TopLevelTab, FileBackedCustomModeSettingsItem[]>;

export interface BuiltInModePromptEntry extends Omit<BuiltInModePromptSettingsItem, 'prompt'> {
    prompt: {
        roleDefinition: string;
        customInstructions: string;
    };
}

export type TopLevelDraftState = Partial<Record<TopLevelTab, { profileId: string; value: string }>>;
export type BuiltInModeDraftState = Partial<
    Record<string, { profileId: string; roleDefinition: string; customInstructions: string }>
>;
export type BuiltInToolMetadataDraftState = Partial<Record<string, { description: string }>>;
export type CustomModeScope = 'global' | 'workspace';

export interface CustomModeEditorDraftBase {
    scope: CustomModeScope;
    slug: string;
    name: string;
    authoringRole: ModeAuthoringRole;
    roleTemplate: ModeRoleTemplateKey;
    description: string;
    roleDefinition: string;
    customInstructions: string;
    whenToUse: string;
    tagsText: string;
    deleteConfirmed: boolean;
    sourceText: string;
}

export interface CreateCustomModeEditorDraft extends CustomModeEditorDraftBase {
    kind: 'create';
}

export interface DraftCustomModeEditorDraft extends CustomModeEditorDraftBase {
    kind: 'draft';
    draftId: string;
    validationState: ModeDraftRecord['validationState'];
    validationErrors: string[];
}

export interface EditCustomModeEditorDraft extends CustomModeEditorDraftBase {
    kind: 'edit';
    topLevelTab: TopLevelTab;
    modeKey: string;
}

export type CustomModeEditorDraft = CreateCustomModeEditorDraft | DraftCustomModeEditorDraft | EditCustomModeEditorDraft;

export interface PromptSettingsSnapshot {
    appGlobalInstructions: string;
    profileGlobalInstructions: string;
    topLevelInstructions: Record<TopLevelTab, string>;
    builtInModes: Record<TopLevelTab, BuiltInModePromptSettingsItem[]>;
    fileBackedCustomModes: {
        global: Record<TopLevelTab, FileBackedCustomModeSettingsItem[]>;
        workspace?: Record<TopLevelTab, FileBackedCustomModeSettingsItem[]>;
    };
    delegatedWorkerModes: {
        global: FileBackedCustomModeSettingsItem[];
        workspace?: FileBackedCustomModeSettingsItem[];
    };
    modeDrafts: ModeDraftRecord[];
}

export type BuiltInToolMetadataSnapshot = BuiltInToolMetadataEntry[];

export function resolveTopLevelDraftValue(input: {
    profileId: string;
    topLevelTab: TopLevelTab;
    persistedValue: string | undefined;
    drafts: TopLevelDraftState;
}): string {
    const draft = input.drafts[input.topLevelTab];
    if (draft?.profileId === input.profileId) {
        return draft.value;
    }

    return input.persistedValue ?? '';
}

export function emptyModeItems(): Record<TopLevelTab, FileBackedCustomModeSettingsItem[]> {
    return {
        chat: [],
        agent: [],
        orchestrator: [],
    };
}

export function normalizeOptionalText(value: string): string | undefined {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
}

export function parseListText(value: string): string[] | undefined {
    const items = value
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    return items.length > 0 ? Array.from(new Set(items)) : undefined;
}

export function formatDelimitedLabel(value: string): string {
    return value
        .split(/[_-]+/g)
        .filter((part) => part.length > 0)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

export function formatRuntimeProfileLabel(value: RuntimeRequirementProfile): string {
    switch (value) {
        case 'general':
            return 'General';
        case 'read_only_agent':
            return 'Read-Only Agent';
        case 'mutating_agent':
            return 'Mutating Agent';
        case 'planner':
            return 'Planner';
        case 'orchestrator':
            return 'Orchestrator';
        case 'reviewer':
            return 'Reviewer';
        default:
            return formatDelimitedLabel(value);
    }
}

export function createEmptyCustomModeEditorDraft(scope: CustomModeScope): CreateCustomModeEditorDraft {
    return {
        kind: 'create',
        scope,
        slug: '',
        name: '',
        authoringRole: 'chat',
        roleTemplate: 'chat/default',
        description: '',
        roleDefinition: '',
        customInstructions: '',
        whenToUse: '',
        tagsText: '',
        deleteConfirmed: false,
        sourceText: '',
    };
}

export function resolveCustomModeEditorTopLevelTab(draft: CustomModeEditorDraft): TopLevelTab {
    return draft.kind === 'edit'
        ? draft.topLevelTab
        : listModeRoleTemplateDefinitions().find((definition) => definition.roleTemplate === draft.roleTemplate)
              ?.topLevelTab ?? 'agent';
}

export function getModeRoleTemplateOptions(authoringRole: ModeAuthoringRole) {
    return listModeRoleTemplateDefinitions().filter((definition) => definition.authoringRole === authoringRole);
}
