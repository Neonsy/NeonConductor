import type { TopLevelTab } from '@/app/backend/runtime/contracts/enums';
import type { ProfileInput } from '@/app/backend/runtime/contracts/types/common';

export interface ModeExecutionPolicy {
    planningOnly?: boolean;
    readOnly?: boolean;
}

export interface ModeDefinition {
    id: string;
    profileId: string;
    topLevelTab: TopLevelTab;
    modeKey: string;
    label: string;
    prompt: Record<string, unknown>;
    executionPolicy: ModeExecutionPolicy;
    source: string;
    enabled: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface RulesetDefinition {
    id: string;
    profileId: string;
    workspaceFingerprint?: string;
    name: string;
    bodyMarkdown: string;
    source: string;
    enabled: boolean;
    precedence: number;
    createdAt: string;
    updatedAt: string;
}

export interface SkillfileDefinition {
    id: string;
    profileId: string;
    workspaceFingerprint?: string;
    name: string;
    bodyMarkdown: string;
    source: string;
    enabled: boolean;
    precedence: number;
    createdAt: string;
    updatedAt: string;
}

export interface ModeListInput extends ProfileInput {
    topLevelTab: TopLevelTab;
}

export interface ModeGetActiveInput extends ModeListInput {
    workspaceFingerprint?: string;
}

export interface ModeSetActiveInput extends ModeGetActiveInput {
    modeKey: string;
}
