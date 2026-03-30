import { describe, expect, it } from 'vitest';

import {
    conversationStore,
    getDefaultProfileId,
    registerPersistenceStoreHooks,
    sessionStore,
    threadStore,
} from '@/app/backend/persistence/__tests__/stores.shared';
import { runtimeEventStore } from '@/app/backend/persistence/stores';
import { getPersistence } from '@/app/backend/persistence/db';
import { parseEntityId } from '@/app/backend/persistence/stores/shared/rowParsers';
import { createEntityId } from '@/app/backend/runtime/identity/entityIds';

import { deleteDelegatedChildLane } from './delegatedChildLaneDeletionLifecycle';

registerPersistenceStoreHooks();

async function seedDelegatedChildLaneFixture() {
    const profileId = getDefaultProfileId();
    const workspaceFingerprint = 'wsf_delegated_child_lane';
    const orchestratorRunId = createEntityId('orch');
    const mismatchedOrchestratorRunId = createEntityId('orch');

    const conversation = await conversationStore.createOrGetBucket({
        profileId,
        scope: 'workspace',
        workspaceFingerprint,
        title: 'Delegated Child Lane',
    });
    if (conversation.isErr()) {
        throw new Error(conversation.error.message);
    }

    const thread = await threadStore.create({
        profileId,
        conversationId: conversation.value.id,
        title: 'Delegated Worker',
        topLevelTab: 'agent',
        delegatedFromOrchestratorRunId: orchestratorRunId,
    });
    if (thread.isErr()) {
        throw new Error(thread.error.message);
    }

    const session = await sessionStore.create(profileId, thread.value.id, 'local', {
        delegatedFromOrchestratorRunId: orchestratorRunId,
    });
    if (!session.created) {
        throw new Error(`Expected delegated session creation to succeed, received "${session.reason}".`);
    }

    await runtimeEventStore.append({
        entityType: 'thread',
        domain: 'thread',
        operation: 'remove',
        entityId: thread.value.id,
        eventType: 'test.delegated-child-lane',
        payload: {},
    });
    await runtimeEventStore.append({
        entityType: 'session',
        domain: 'session',
        operation: 'remove',
        entityId: session.session.id,
        eventType: 'test.delegated-child-lane',
        payload: {},
    });

    return {
        profileId,
        workspaceFingerprint,
        threadId: thread.value.id,
        sessionId: session.session.id,
        orchestratorRunId,
        mismatchedOrchestratorRunId,
    };
}

describe('delegatedChildLaneDeletionLifecycle', () => {
    it('fails closed when ownership does not match', async () => {
        const fixture = await seedDelegatedChildLaneFixture();

        const deleted = await deleteDelegatedChildLane({
            profileId: fixture.profileId,
            threadId: parseEntityId(fixture.threadId, 'threads.id', 'thr'),
            sessionId: fixture.sessionId,
            orchestratorRunId: fixture.mismatchedOrchestratorRunId,
        });

        expect(deleted).toBe(false);

        const remainingThread = await threadStore.getListRecordById(fixture.profileId, fixture.threadId);
        expect(remainingThread?.id).toBe(fixture.threadId);

        const remainingSession = await sessionStore.status(fixture.profileId, fixture.sessionId);
        expect(remainingSession.found).toBe(true);
    });

    it('deletes the delegated child lane when ownership matches', async () => {
        const fixture = await seedDelegatedChildLaneFixture();

        const deleted = await deleteDelegatedChildLane({
            profileId: fixture.profileId,
            threadId: parseEntityId(fixture.threadId, 'threads.id', 'thr'),
            sessionId: fixture.sessionId,
            orchestratorRunId: fixture.orchestratorRunId,
        });

        expect(deleted).toBe(true);

        const remainingThread = await threadStore.getListRecordById(fixture.profileId, fixture.threadId);
        expect(remainingThread).toBeNull();

        const remainingSession = await sessionStore.status(fixture.profileId, fixture.sessionId);
        expect(remainingSession.found).toBe(false);

        const { db } = getPersistence();
        const remainingRuntimeEvents = await db
            .selectFrom('runtime_events')
            .select(['entity_id'])
            .where('entity_id', 'in', [fixture.threadId, fixture.sessionId])
            .execute();
        expect(remainingRuntimeEvents).toEqual([]);
    });
});
