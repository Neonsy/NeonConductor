import type { TopLevelTab } from '@/app/backend/runtime/contracts/enums';
import type {
    ModeDefinitionRecord,
    RulesetDefinitionRecord,
    SkillfileDefinitionRecord,
} from '@/app/backend/persistence/types';
import type { EntityId } from '@/app/backend/runtime/contracts/ids';
import type { ProfileInput } from '@/app/backend/runtime/contracts/types/common';

export interface RegistryRefreshInput extends ProfileInput {
    workspaceFingerprint?: string;
    worktreeId?: EntityId<'wt'>;
}

export interface RegistryListResolvedInput extends ProfileInput {
    workspaceFingerprint?: string;
    worktreeId?: EntityId<'wt'>;
}

export interface RegistrySearchSkillsInput extends ProfileInput {
    query?: string;
    workspaceFingerprint?: string;
    worktreeId?: EntityId<'wt'>;
    topLevelTab?: TopLevelTab;
    modeKey?: string;
}

export interface RegistrySearchRulesInput extends ProfileInput {
    query?: string;
    workspaceFingerprint?: string;
    worktreeId?: EntityId<'wt'>;
    topLevelTab?: TopLevelTab;
    modeKey?: string;
}

export interface RegistryPaths {
    globalAssetsRoot: string;
    workspaceAssetsRoot?: string;
}

export interface RegistryResolvedView {
    modes: ModeDefinitionRecord[];
    rulesets: RulesetDefinitionRecord[];
    skillfiles: SkillfileDefinitionRecord[];
}

export interface RegistryDiscoveredView {
    global: RegistryResolvedView;
    workspace?: RegistryResolvedView;
}

export interface RegistryListResolvedResult {
    paths: RegistryPaths;
    discovered: RegistryDiscoveredView;
    resolved: RegistryResolvedView;
}

export interface RegistryRefreshResult {
    paths: RegistryPaths;
    refreshed: {
        global: {
            modes: number;
            rulesets: number;
            skillfiles: number;
        };
        workspace?: {
            modes: number;
            rulesets: number;
            skillfiles: number;
        };
    };
    resolvedRegistry: RegistryListResolvedResult;
    agentModes: ModeDefinitionRecord[];
    activeAgentMode: ModeDefinitionRecord;
}
