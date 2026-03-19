import type { RuntimeEventContext, TrpcUtils } from '@/web/lib/runtime/invalidation/shared';
import {
    addInvalidation,
    hasPayloadKey,
    invalidateSelectedMessages,
    invalidateSessionAttachedRules,
    invalidateSessionAttachedSkills,
    invalidateSessionCheckpoints,
    invalidateSessionList,
    invalidateSessionRuns,
    invalidateSessionStatus,
    invalidateBucketList,
    invalidateShellBootstrap,
    invalidateTagList,
    invalidateThreadList,
    isSelectedThreadAffected,
} from '@/web/lib/runtime/invalidation/shared';

import type { RuntimeEventRecordV1 } from '@/app/backend/persistence/types';

function readStringArray(value: unknown): string[] | undefined {
    return Array.isArray(value) && value.every((entry) => typeof entry === 'string') ? value : undefined;
}

function isThreadRelationEvent(event: RuntimeEventRecordV1, context: RuntimeEventContext): boolean {
    return Boolean(context.tagId || hasPayloadKey(event, 'tagIds'));
}

function isBucketAffectingThreadEvent(event: RuntimeEventRecordV1): boolean {
    return event.operation === 'remove' || hasPayloadKey(event, 'bucket');
}

function isTagRelationEvent(event: RuntimeEventRecordV1, context: RuntimeEventContext): boolean {
    return Boolean(context.threadId || context.tagId || hasPayloadKey(event, 'tagIds'));
}

function hasSelectedThreadIdentityImpact(event: RuntimeEventRecordV1, context: RuntimeEventContext): boolean {
    if (isSelectedThreadAffected(context)) {
        return true;
    }

    const selectedThreadId = context.selection.selectedThreadId;
    const selectedSessionId = context.selection.selectedSessionId;
    if (!selectedThreadId && !selectedSessionId) {
        return false;
    }

    const deletedThreadIds = readStringArray(event.payload['deletedThreadIds']) ?? [];
    if (selectedThreadId && deletedThreadIds.includes(selectedThreadId)) {
        return true;
    }

    const sessionIds = readStringArray(event.payload['sessionIds']) ?? [];
    return Boolean(selectedSessionId && sessionIds.includes(selectedSessionId));
}

export async function invalidateConversationQueries(utils: TrpcUtils, context: RuntimeEventContext): Promise<void> {
    await Promise.all([invalidateThreadList(utils, context.profileId), invalidateBucketList(utils, context.profileId)]);
}

export async function invalidateThreadQueries(
    utils: TrpcUtils,
    event: RuntimeEventRecordV1,
    context: RuntimeEventContext
): Promise<void> {
    const invalidations: Promise<void>[] = [invalidateThreadList(utils, context.profileId)];
    if (isBucketAffectingThreadEvent(event)) {
        addInvalidation(invalidations, invalidateBucketList(utils, context.profileId));
    }
    if (isThreadRelationEvent(event, context)) {
        addInvalidation(invalidations, invalidateTagList(utils, context.profileId));
        addInvalidation(invalidations, invalidateShellBootstrap(utils, context.profileId));
    }

    await Promise.all(invalidations);
}

export async function invalidateThreadSelectionFreshnessQueries(
    utils: TrpcUtils,
    event: RuntimeEventRecordV1,
    context: RuntimeEventContext
): Promise<void> {
    if (!hasSelectedThreadIdentityImpact(event, context)) {
        return;
    }

    const invalidations: Promise<void>[] = [
        invalidateSessionList(utils, context.profileId),
        invalidateSessionAttachedRules(utils),
        invalidateSessionAttachedSkills(utils),
    ];

    addInvalidation(
        invalidations,
        invalidateSessionStatus(utils, context.profileId, context.selection.selectedSessionId)
    );
    addInvalidation(
        invalidations,
        invalidateSessionRuns(utils, context.profileId, context.selection.selectedSessionId)
    );
    addInvalidation(
        invalidations,
        invalidateSessionCheckpoints(utils, context.profileId, context.selection.selectedSessionId)
    );
    addInvalidation(invalidations, invalidateSelectedMessages(utils, context));

    await Promise.all(invalidations);
}

export async function invalidateTagQueries(
    utils: TrpcUtils,
    event: RuntimeEventRecordV1,
    context: RuntimeEventContext
): Promise<void> {
    const invalidations: Promise<void>[] = [invalidateTagList(utils, context.profileId)];
    if (isTagRelationEvent(event, context)) {
        addInvalidation(invalidations, invalidateThreadList(utils, context.profileId));
        addInvalidation(invalidations, invalidateBucketList(utils, context.profileId));
        addInvalidation(invalidations, invalidateShellBootstrap(utils, context.profileId));
    }

    await Promise.all(invalidations);
}
