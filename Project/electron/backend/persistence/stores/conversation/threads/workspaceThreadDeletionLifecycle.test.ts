import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
    checkpointStore,
    conversationStore,
    diffStore,
    getDefaultProfileId,
    getPersistence,
    messageStore,
    registerPersistenceStoreHooks,
    runStore,
    sessionStore,
    tagStore,
    threadStore,
} from '@/app/backend/persistence/__tests__/stores.shared';
import { runtimeEventStore } from '@/app/backend/persistence/stores';
import { parseEntityId } from '@/app/backend/persistence/stores/shared/rowParsers';

import {
    applyWorkspaceThreadDeletion,
    getWorkspaceThreadDeletionPreview,
} from './workspaceThreadDeletionLifecycle';

registerPersistenceStoreHooks();

async function seedWorkspaceDeletionFixture() {
    const profileId = getDefaultProfileId();
    const workspaceFingerprint = 'wsf_workspace_bulk_delete';

    const removableConversation = await conversationStore.createOrGetBucket({
        profileId,
        scope: 'workspace',
        workspaceFingerprint,
        title: 'Workspace Delete A',
    });
    if (removableConversation.isErr()) {
        throw new Error(removableConversation.error.message);
    }
    const protectedConversation = await conversationStore.createOrGetBucket({
        profileId,
        scope: 'workspace',
        workspaceFingerprint,
        title: 'Workspace Delete B',
    });
    if (protectedConversation.isErr()) {
        throw new Error(protectedConversation.error.message);
    }

    const removableThread = await threadStore.create({
        profileId,
        conversationId: removableConversation.value.id,
        title: 'Removable',
        topLevelTab: 'chat',
    });
    const protectedThread = await threadStore.create({
        profileId,
        conversationId: protectedConversation.value.id,
        title: 'Favorite',
        topLevelTab: 'chat',
    });
    if (removableThread.isErr()) {
        throw new Error(removableThread.error.message);
    }
    if (protectedThread.isErr()) {
        throw new Error(protectedThread.error.message);
    }

    const favoriteUpdate = await threadStore.setFavorite(
        profileId,
        parseEntityId(protectedThread.value.id, 'threads.id', 'thr'),
        true
    );
    if (favoriteUpdate.isErr()) {
        throw new Error(favoriteUpdate.error.message);
    }

    const removableTagResult = await tagStore.upsert(profileId, 'remove-me');
    const protectedTagResult = await tagStore.upsert(profileId, 'keep-me');
    if (removableTagResult.isErr()) {
        throw new Error(removableTagResult.error.message);
    }
    if (protectedTagResult.isErr()) {
        throw new Error(protectedTagResult.error.message);
    }

    const removableTagLink = await tagStore.setThreadTags(profileId, removableThread.value.id, [
        removableTagResult.value.id,
    ]);
    const protectedTagLink = await tagStore.setThreadTags(profileId, protectedThread.value.id, [
        protectedTagResult.value.id,
    ]);
    if (removableTagLink.isErr()) {
        throw new Error(removableTagLink.error.message);
    }
    if (protectedTagLink.isErr()) {
        throw new Error(protectedTagLink.error.message);
    }

    const session = await sessionStore.create(profileId, removableThread.value.id, 'local');
    if (!session.created) {
        throw new Error(`Expected session creation to succeed, received "${session.reason}".`);
    }

    const run = await runStore.create({
        profileId,
        sessionId: session.session.id,
        prompt: 'delete me',
        providerId: 'openai',
        modelId: 'openai/gpt-5',
        authMethod: 'api_key',
        runtimeOptions: {
            reasoning: {
                effort: 'none',
                summary: 'none',
                includeEncrypted: false,
            },
            cache: {
                strategy: 'auto',
            },
            transport: {
                family: 'auto',
            },
        },
        cache: {
            applied: false,
        },
        transport: {},
    });
    await sessionStore.markRunPending(profileId, session.session.id, run.id);
    await runStore.finalize(run.id, { status: 'completed' });
    await sessionStore.markRunTerminal(profileId, session.session.id, 'completed');

    const message = await messageStore.createMessage({
        profileId,
        sessionId: session.session.id,
        runId: run.id,
        role: 'assistant',
    });
    const messagePart = await messageStore.createPart({
        messageId: message.id,
        partType: 'text',
        payload: {
            text: 'workspace delete fixture',
        },
    });

    const diff = await diffStore.create({
        profileId,
        sessionId: session.session.id,
        runId: run.id,
        summary: 'created patch',
        artifact: {
            kind: 'git',
            workspaceRootPath: `M:\\workspace\\${randomUUID()}`,
            workspaceLabel: 'workspace',
            baseRef: 'HEAD',
            fileCount: 1,
            files: [{ path: 'README.md', status: 'modified' }],
            fullPatch: 'diff --git a/README.md b/README.md\n',
            patchesByPath: {
                'README.md': 'diff --git a/README.md b/README.md\n',
            },
        },
    });
    const checkpoint = await checkpointStore.create({
        profileId,
        sessionId: session.session.id,
        threadId: parseEntityId(removableThread.value.id, 'threads.id', 'thr'),
        runId: run.id,
        diffId: diff.id,
        workspaceFingerprint,
        executionTargetKey: 'workspace:/workspace/a',
        executionTargetKind: 'workspace',
        executionTargetLabel: 'workspace',
        createdByKind: 'system',
        checkpointKind: 'auto',
        snapshotFileCount: 1,
        topLevelTab: 'agent',
        modeKey: 'code',
        summary: 'created checkpoint',
    });

    const runtimeEventSeed = [
        { entityType: 'conversation', domain: 'conversation', entityId: removableConversation.value.id },
        { entityType: 'thread', domain: 'thread', entityId: removableThread.value.id },
        { entityType: 'thread', domain: 'thread', entityId: protectedThread.value.id },
        { entityType: 'tag', domain: 'tag', entityId: removableTagResult.value.id },
        { entityType: 'tag', domain: 'tag', entityId: protectedTagResult.value.id },
        { entityType: 'session', domain: 'session', entityId: session.session.id },
        { entityType: 'run', domain: 'run', entityId: run.id },
        { entityType: 'message', domain: 'message', entityId: message.id },
        { entityType: 'messagePart', domain: 'messagePart', entityId: messagePart.id },
        { entityType: 'checkpoint', domain: 'checkpoint', entityId: checkpoint.id },
        { entityType: 'diff', domain: 'diff', entityId: diff.id },
    ] as const;
    for (const seed of runtimeEventSeed) {
        await runtimeEventStore.append({
            entityType: seed.entityType,
            domain: seed.domain,
            operation: 'remove',
            entityId: seed.entityId,
            eventType: 'test.workspace-delete',
            payload: {},
        });
    }

    return {
        profileId,
        workspaceFingerprint,
        workspaceConversationId: removableConversation.value.id,
        removableThreadId: removableThread.value.id,
        protectedThreadId: protectedThread.value.id,
        removableTagId: removableTagResult.value.id,
        protectedTagId: protectedTagResult.value.id,
        sessionId: session.session.id,
        runId: run.id,
        messageId: message.id,
        messagePartId: messagePart.id,
        checkpointId: checkpoint.id,
        diffId: diff.id,
    };
}

describe('workspaceThreadDeletionLifecycle', () => {
    it('preserves favorite protection in delete preview', async () => {
        const fixture = await seedWorkspaceDeletionFixture();

        const preview = await getWorkspaceThreadDeletionPreview({
            profileId: fixture.profileId,
            workspaceFingerprint: fixture.workspaceFingerprint,
            includeFavorites: false,
        });

        expect(preview).toEqual({
            workspaceFingerprint: fixture.workspaceFingerprint,
            totalThreadCount: 2,
            favoriteThreadCount: 1,
            deletableThreadCount: 1,
        });
    });

    it('returns the same fallout ids and counts during apply as the resolved plan', async () => {
        const fixture = await seedWorkspaceDeletionFixture();

        const preview = await getWorkspaceThreadDeletionPreview({
            profileId: fixture.profileId,
            workspaceFingerprint: fixture.workspaceFingerprint,
            includeFavorites: false,
        });
        expect(preview.deletableThreadCount).toBe(1);

        const applied = await applyWorkspaceThreadDeletion({
            profileId: fixture.profileId,
            workspaceFingerprint: fixture.workspaceFingerprint,
            includeFavorites: false,
        });

        expect(applied).toEqual({
            totalThreadCount: 2,
            favoriteThreadCount: 1,
            deletableThreadIds: [fixture.removableThreadId],
            deletedTagIds: [fixture.removableTagId],
            deletedConversationIds: [],
            sessionIds: [fixture.sessionId],
            runIds: [fixture.runId],
            messageIds: [fixture.messageId],
            messagePartIds: [fixture.messagePartId],
            checkpointIds: [fixture.checkpointId],
            diffIds: [fixture.diffId],
            runtimeEventEntityIds: expect.arrayContaining([
                fixture.removableThreadId,
                fixture.removableTagId,
                fixture.sessionId,
                fixture.runId,
                fixture.messageId,
                fixture.messagePartId,
                fixture.checkpointId,
                fixture.diffId,
            ]),
        });

        const deletedConversation = await conversationStore.getBucketById(
            fixture.profileId,
            fixture.workspaceConversationId
        );
        expect(deletedConversation?.id).toBe(fixture.workspaceConversationId);

        const remainingTags = await tagStore.listByProfile(fixture.profileId);
        expect(remainingTags.map((tag) => tag.id)).toEqual([fixture.protectedTagId]);

        const remainingThreads = await threadStore.list({
            profileId: fixture.profileId,
            activeTab: 'chat',
            showAllModes: true,
            groupView: 'workspace',
            scope: 'workspace',
            workspaceFingerprint: fixture.workspaceFingerprint,
            sort: 'latest',
        });
        expect(remainingThreads.map((thread) => thread.id)).toEqual([fixture.protectedThreadId]);

        const remainingMessages = await messageStore.listMessagesByProfile(fixture.profileId);
        expect(remainingMessages.map((message) => message.id)).toEqual([]);

        const remainingMessageParts = await messageStore.listPartsByProfile(fixture.profileId);
        expect(remainingMessageParts.map((part) => part.id)).toEqual([]);

        const remainingDiffs = await diffStore.listByProfile(fixture.profileId);
        expect(remainingDiffs.map((diff) => diff.id)).toEqual([]);

        const remainingCheckpoints = await checkpointStore.listByProfile(fixture.profileId);
        expect(remainingCheckpoints.map((checkpoint) => checkpoint.id)).toEqual([]);

        const { db } = getPersistence();
        const remainingRuntimeEvents = await db
            .selectFrom('runtime_events')
            .select(['entity_id'])
            .where('entity_id', 'in', applied.runtimeEventEntityIds)
            .execute();
        expect(remainingRuntimeEvents).toEqual([]);
    });

    it('returns a zero-deletable-thread fast path when only favorites are protected', async () => {
        const profileId = getDefaultProfileId();
        const workspaceFingerprint = 'wsf_workspace_delete_fast_path';
        const conversation = await conversationStore.createOrGetBucket({
            profileId,
            scope: 'workspace',
            workspaceFingerprint,
            title: 'Workspace Delete Fast Path',
        });
        if (conversation.isErr()) {
            throw new Error(conversation.error.message);
        }

        const thread = await threadStore.create({
            profileId,
            conversationId: conversation.value.id,
            title: 'Favorite',
            topLevelTab: 'chat',
        });
        if (thread.isErr()) {
            throw new Error(thread.error.message);
        }

        const favoriteUpdate = await threadStore.setFavorite(
            profileId,
            parseEntityId(thread.value.id, 'threads.id', 'thr'),
            true
        );
        if (favoriteUpdate.isErr()) {
            throw new Error(favoriteUpdate.error.message);
        }

        const preview = await getWorkspaceThreadDeletionPreview({
            profileId,
            workspaceFingerprint,
            includeFavorites: false,
        });
        expect(preview).toEqual({
            workspaceFingerprint,
            totalThreadCount: 1,
            favoriteThreadCount: 1,
            deletableThreadCount: 0,
        });

        const applied = await applyWorkspaceThreadDeletion({
            profileId,
            workspaceFingerprint,
            includeFavorites: false,
        });
        expect(applied.deletableThreadIds).toEqual([]);
        expect(applied.deletedConversationIds).toEqual([]);
        expect(applied.deletedTagIds).toEqual([]);
        expect(applied.sessionIds).toEqual([]);

        const remainingThreads = await threadStore.list({
            profileId,
            activeTab: 'chat',
            showAllModes: true,
            groupView: 'workspace',
            scope: 'workspace',
            workspaceFingerprint,
            sort: 'latest',
        });
        expect(remainingThreads.map((item) => item.id)).toEqual([thread.value.id]);
    });
});
