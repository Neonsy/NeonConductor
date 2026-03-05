import { conversationScopes, conversationThreadSorts } from '@/app/backend/runtime/contracts/enums';
import {
    createParser,
    readEntityId,
    readEnumValue,
    readObject,
    readOptionalString,
    readProfileId,
    readString,
    readStringArray,
} from '@/app/backend/runtime/contracts/parsers/helpers';
import { parseProfileInput } from '@/app/backend/runtime/contracts/parsers/profile';
import type {
    ConversationCreateThreadInput,
    ConversationListBucketsInput,
    ConversationListTagsInput,
    ConversationListThreadsInput,
    ConversationRenameThreadInput,
    ConversationSetThreadTagsInput,
    ConversationUpsertTagInput,
} from '@/app/backend/runtime/contracts/types';

export function parseConversationListBucketsInput(input: unknown): ConversationListBucketsInput {
    return parseProfileInput(input);
}

export function parseConversationListThreadsInput(input: unknown): ConversationListThreadsInput {
    const source = readObject(input, 'input');
    const scope = source.scope !== undefined ? readEnumValue(source.scope, 'scope', conversationScopes) : undefined;
    const workspaceFingerprint = readOptionalString(source.workspaceFingerprint, 'workspaceFingerprint');

    if (workspaceFingerprint && scope !== 'workspace') {
        throw new Error('Invalid "workspaceFingerprint": allowed only when scope is "workspace".');
    }

    return {
        profileId: readProfileId(source),
        ...(scope ? { scope } : {}),
        ...(workspaceFingerprint ? { workspaceFingerprint } : {}),
        ...(source.sort !== undefined ? { sort: readEnumValue(source.sort, 'sort', conversationThreadSorts) } : {}),
    };
}

export function parseConversationCreateThreadInput(input: unknown): ConversationCreateThreadInput {
    const source = readObject(input, 'input');
    const scope = readEnumValue(source.scope, 'scope', conversationScopes);
    const workspaceFingerprint = readOptionalString(source.workspaceFingerprint, 'workspaceFingerprint');

    if (scope === 'workspace' && !workspaceFingerprint) {
        throw new Error('Invalid "workspaceFingerprint": required when scope is "workspace".');
    }

    if (scope !== 'workspace' && workspaceFingerprint) {
        throw new Error('Invalid "workspaceFingerprint": allowed only when scope is "workspace".');
    }

    return {
        profileId: readProfileId(source),
        scope,
        ...(workspaceFingerprint ? { workspaceFingerprint } : {}),
        title: readString(source.title, 'title'),
    };
}

export function parseConversationRenameThreadInput(input: unknown): ConversationRenameThreadInput {
    const source = readObject(input, 'input');

    return {
        profileId: readProfileId(source),
        threadId: readEntityId(source.threadId, 'threadId', 'thr'),
        title: readString(source.title, 'title'),
    };
}

export function parseConversationListTagsInput(input: unknown): ConversationListTagsInput {
    return parseProfileInput(input);
}

export function parseConversationUpsertTagInput(input: unknown): ConversationUpsertTagInput {
    const source = readObject(input, 'input');

    return {
        profileId: readProfileId(source),
        label: readString(source.label, 'label'),
    };
}

export function parseConversationSetThreadTagsInput(input: unknown): ConversationSetThreadTagsInput {
    const source = readObject(input, 'input');
    const tagIds = readStringArray(source.tagIds, 'tagIds');

    return {
        profileId: readProfileId(source),
        threadId: readEntityId(source.threadId, 'threadId', 'thr'),
        tagIds,
    };
}

export const conversationListBucketsInputSchema = createParser(parseConversationListBucketsInput);
export const conversationListThreadsInputSchema = createParser(parseConversationListThreadsInput);
export const conversationCreateThreadInputSchema = createParser(parseConversationCreateThreadInput);
export const conversationRenameThreadInputSchema = createParser(parseConversationRenameThreadInput);
export const conversationListTagsInputSchema = createParser(parseConversationListTagsInput);
export const conversationUpsertTagInputSchema = createParser(parseConversationUpsertTagInput);
export const conversationSetThreadTagsInputSchema = createParser(parseConversationSetThreadTagsInput);
