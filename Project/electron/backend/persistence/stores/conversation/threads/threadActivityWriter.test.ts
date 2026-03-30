import { describe, expect, it } from 'vitest';

import {
    conversationStore,
    getDefaultProfileId,
    getPersistence,
    registerPersistenceStoreHooks,
    threadStore,
} from '@/app/backend/persistence/__tests__/stores.shared';

import { markThreadAssistantActivity, touchThreadActivity } from './threadActivityWriter';

registerPersistenceStoreHooks();

describe('threadActivityWriter', () => {
    it('touches thread and conversation timestamps together', async () => {
        const profileId = getDefaultProfileId();
        const conversation = await conversationStore.createOrGetBucket({
            profileId,
            scope: 'workspace',
            workspaceFingerprint: 'wsf_activity_touch',
            title: 'Workspace',
        });
        if (conversation.isErr()) {
            throw new Error(conversation.error.message);
        }

        const thread = await threadStore.create({
            profileId,
            conversationId: conversation.value.id,
            title: 'Touch me',
            topLevelTab: 'chat',
        });
        if (thread.isErr()) {
            throw new Error(thread.error.message);
        }

        const { db } = getPersistence();
        await db
            .updateTable('threads')
            .set({ updated_at: '2026-03-01T00:00:00.000Z' })
            .where('id', '=', thread.value.id)
            .execute();
        await db
            .updateTable('conversations')
            .set({ updated_at: '2026-03-01T00:00:00.000Z' })
            .where('id', '=', conversation.value.id)
            .execute();

        await touchThreadActivity(profileId, thread.value.id);

        const touchedThread = await threadStore.getById(profileId, thread.value.id);
        const touchedConversation = await conversationStore.getBucketById(profileId, conversation.value.id);
        expect(touchedThread?.updatedAt).not.toBe('2026-03-01T00:00:00.000Z');
        expect(touchedConversation?.updatedAt).not.toBe('2026-03-01T00:00:00.000Z');
    });

    it('keeps the latest assistant activity timestamp when older updates arrive later', async () => {
        const profileId = getDefaultProfileId();
        const conversation = await conversationStore.createOrGetBucket({
            profileId,
            scope: 'workspace',
            workspaceFingerprint: 'wsf_activity_assistant',
            title: 'Workspace',
        });
        if (conversation.isErr()) {
            throw new Error(conversation.error.message);
        }

        const thread = await threadStore.create({
            profileId,
            conversationId: conversation.value.id,
            title: 'Assistant activity',
            topLevelTab: 'chat',
        });
        if (thread.isErr()) {
            throw new Error(thread.error.message);
        }

        const { db } = getPersistence();
        await db
            .updateTable('threads')
            .set({
                last_assistant_at: '2026-03-10T00:00:00.000Z',
                updated_at: '2026-03-10T00:00:00.000Z',
            })
            .where('id', '=', thread.value.id)
            .execute();

        await markThreadAssistantActivity(profileId, thread.value.id, '2026-03-12T00:00:00.000Z');
        await markThreadAssistantActivity(profileId, thread.value.id, '2026-03-11T00:00:00.000Z');

        const updatedThread = await threadStore.getById(profileId, thread.value.id);
        expect(updatedThread?.lastAssistantAt).toBe('2026-03-12T00:00:00.000Z');
    });
});
