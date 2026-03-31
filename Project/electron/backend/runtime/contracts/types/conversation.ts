import type {
    ConversationEditResolution,
    ConversationScope,
    ConversationThreadGroupView,
    ConversationThreadSort,
    ExecutionEnvironmentMode,
    ThreadTitleGenerationMode,
    TopLevelTab,
} from '@/app/backend/runtime/contracts/enums';
import type { EntityId } from '@/app/backend/runtime/contracts/ids';
import type { ProfileInput } from '@/app/backend/runtime/contracts/types/common';

export type ConversationListBucketsInput = ProfileInput;

export interface ConversationListThreadsInput extends ProfileInput {
    activeTab?: TopLevelTab;
    showAllModes?: boolean;
    groupView?: ConversationThreadGroupView;
    scope?: ConversationScope;
    workspaceFingerprint?: string;
    sort?: ConversationThreadSort;
}

export interface ConversationCreateThreadInput extends ProfileInput {
    topLevelTab?: TopLevelTab;
    scope: ConversationScope;
    workspacePath?: string;
    title: string;
    executionEnvironmentMode?: ExecutionEnvironmentMode;
    sandboxId?: EntityId<'sb'>;
}

export interface ConversationRenameThreadInput extends ProfileInput {
    threadId: EntityId<'thr'>;
    title: string;
}

export interface ConversationSetThreadFavoriteInput extends ProfileInput {
    threadId: EntityId<'thr'>;
    isFavorite: boolean;
}

export interface ConversationSetThreadExecutionEnvironmentInput extends ProfileInput {
    threadId: EntityId<'thr'>;
    mode: ExecutionEnvironmentMode;
    sandboxId?: EntityId<'sb'>;
}

export type ConversationListTagsInput = ProfileInput;

export interface ConversationUpsertTagInput extends ProfileInput {
    label: string;
}

export interface ConversationSetThreadTagsInput extends ProfileInput {
    threadId: EntityId<'thr'>;
    tagIds: string[];
}

export interface ConversationWorkspaceThreadDeletePreviewInput extends ProfileInput {
    workspaceFingerprint: string;
    includeFavorites?: boolean;
}

export interface ConversationDeleteWorkspaceThreadsInput extends ProfileInput {
    workspaceFingerprint: string;
    includeFavorites?: boolean;
}

export type ConversationGetEditPreferenceInput = ProfileInput;

export interface ConversationSetEditPreferenceInput extends ProfileInput {
    value: ConversationEditResolution;
}

export type ConversationGetThreadTitlePreferenceInput = ProfileInput;

export interface ConversationSetThreadTitlePreferenceInput extends ProfileInput {
    mode: ThreadTitleGenerationMode;
}

export interface ConversationReadToolArtifactInput extends ProfileInput {
    sessionId: EntityId<'sess'>;
    messagePartId: EntityId<'part'>;
    startLine?: number;
    lineCount?: number;
}

export interface ConversationSearchToolArtifactInput extends ProfileInput {
    sessionId: EntityId<'sess'>;
    messagePartId: EntityId<'part'>;
    query: string;
    caseSensitive?: boolean;
}

export interface ConversationToolArtifactLine {
    lineNumber: number;
    text: string;
}

export interface ConversationReadToolArtifactView {
    messagePartId: EntityId<'part'>;
    toolName: string;
    artifactKind: 'command_output' | 'file_read' | 'directory_listing';
    contentType: string;
    totalBytes: number;
    totalLines: number;
    previewStrategy: 'head_tail' | 'head_only' | 'bounded_list';
    metadata: Record<string, unknown>;
    startLine: number;
    lineCount: number;
    lines: ConversationToolArtifactLine[];
    hasPrevious: boolean;
    hasNext: boolean;
}

export interface ConversationReadToolArtifactResult {
    found: boolean;
    artifact?: ConversationReadToolArtifactView;
}

export interface ConversationToolArtifactSearchMatch {
    lineNumber: number;
    lineText: string;
    matchStart: number;
    matchEnd: number;
}

export interface ConversationSearchToolArtifactResult {
    found: boolean;
    matches: ConversationToolArtifactSearchMatch[];
    truncated: boolean;
}
