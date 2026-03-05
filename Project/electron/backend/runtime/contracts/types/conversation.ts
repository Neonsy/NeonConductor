import type { ConversationScope, ConversationThreadSort } from '@/app/backend/runtime/contracts/enums';
import type { EntityId } from '@/app/backend/runtime/contracts/ids';
import type { ProfileInput } from '@/app/backend/runtime/contracts/types/common';

export type ConversationListBucketsInput = ProfileInput;

export interface ConversationListThreadsInput extends ProfileInput {
    scope?: ConversationScope;
    workspaceFingerprint?: string;
    sort?: ConversationThreadSort;
}

export interface ConversationCreateThreadInput extends ProfileInput {
    scope: ConversationScope;
    workspaceFingerprint?: string;
    title: string;
}

export interface ConversationRenameThreadInput extends ProfileInput {
    threadId: EntityId<'thr'>;
    title: string;
}

export type ConversationListTagsInput = ProfileInput;

export interface ConversationUpsertTagInput extends ProfileInput {
    label: string;
}

export interface ConversationSetThreadTagsInput extends ProfileInput {
    threadId: EntityId<'thr'>;
    tagIds: string[];
}
