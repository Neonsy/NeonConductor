import { beforeEach, describe, expect, it } from 'vitest';

import { getDefaultProfileId, resetPersistenceForTests } from '@/app/backend/persistence/db';
import {
    conversationStore,
    planStore,
    sessionStore,
    threadStore,
} from '@/app/backend/persistence/stores';
import { buildAdvancedPlanningSnapshotScaffold } from '@/app/backend/runtime/services/plan/advancedPlanningScaffold';

describe('planStore advanced planning support', () => {
    beforeEach(() => {
        resetPersistenceForTests();
    });

    async function seedSession(): Promise<`sess_${string}`> {
        const profileId = getDefaultProfileId();
        const conversation = await conversationStore.createOrGetBucket({
            profileId,
            scope: 'workspace',
            workspaceFingerprint: 'wsf_plan_advanced',
            title: 'Plan Advanced Planning',
        });
        if (conversation.isErr()) {
            throw new Error(conversation.error.message);
        }

        const thread = await threadStore.create({
            profileId,
            conversationId: conversation.value.id,
            title: 'Planning Thread',
            topLevelTab: 'agent',
        });
        if (thread.isErr()) {
            throw new Error(thread.error.message);
        }

        const session = await sessionStore.create(profileId, thread.value.id, 'local');
        if (!session.created) {
            throw new Error(`Expected session creation success, received "${session.reason}".`);
        }

        return session.session.id;
    }

    it('persists and loads advanced planning snapshots for advanced plans', async () => {
        const sessionId = await seedSession();
        const advancedSnapshot = buildAdvancedPlanningSnapshotScaffold({
            sourcePrompt: 'Plan an advanced planning lane.',
            questions: [],
            answers: {},
            status: 'draft',
            currentRevisionNumber: 1,
            planningDepth: 'advanced',
            itemDescriptions: ['Inspect the plan surface.', 'Seed the advanced scaffold.'],
        });

        const created = await planStore.create({
            profileId: 'profile_default',
            sessionId,
            topLevelTab: 'agent',
            modeKey: 'plan',
            planningDepth: 'advanced',
            sourcePrompt: 'Plan an advanced planning lane.',
            summaryMarkdown: '# Advanced Plan',
            questions: [],
            advancedSnapshot,
        });

        expect(created.planningDepth).toBe('advanced');
        expect(created.advancedSnapshot).toBeDefined();
        expect(created.advancedSnapshot?.evidenceMarkdown).toContain('Source Prompt');

        const loaded = await planStore.getById('profile_default', created.id);
        expect(loaded?.planningDepth).toBe('advanced');
        expect(loaded?.advancedSnapshot?.rootCauseMarkdown).toContain('The underlying cause is not established yet.');
    });

    it('carries forward the current advanced snapshot when revising without a replacement', async () => {
        const sessionId = await seedSession();
        const advancedSnapshot = buildAdvancedPlanningSnapshotScaffold({
            sourcePrompt: 'Plan an advanced planning lane.',
            questions: [],
            answers: {},
            status: 'draft',
            currentRevisionNumber: 1,
            planningDepth: 'advanced',
            itemDescriptions: ['Inspect the plan surface.', 'Seed the advanced scaffold.'],
        });

        const created = await planStore.create({
            profileId: 'profile_default',
            sessionId,
            topLevelTab: 'agent',
            modeKey: 'plan',
            planningDepth: 'advanced',
            sourcePrompt: 'Plan an advanced planning lane.',
            summaryMarkdown: '# Advanced Plan',
            questions: [],
            advancedSnapshot,
        });

        const revised = await planStore.revise(created.id, '# Revised Plan', ['Inspect the plan surface.']);
        expect(revised?.planningDepth).toBe('advanced');
        expect(revised?.currentRevisionNumber).toBe(2);
        expect(revised?.advancedSnapshot?.evidenceMarkdown).toBe(created.advancedSnapshot?.evidenceMarkdown);
        expect(revised?.advancedSnapshot?.phases).toEqual(created.advancedSnapshot?.phases);
    });

    it('upgrades a simple plan into advanced planning with a new revision', async () => {
        const sessionId = await seedSession();
        const created = await planStore.create({
            profileId: 'profile_default',
            sessionId,
            topLevelTab: 'agent',
            modeKey: 'plan',
            sourcePrompt: 'Plan an advanced planning lane.',
            summaryMarkdown: '# Simple Plan',
            questions: [],
        });

        const advancedSnapshot = buildAdvancedPlanningSnapshotScaffold({
            sourcePrompt: created.sourcePrompt,
            questions: created.questions,
            answers: created.answers,
            status: created.status,
            currentRevisionNumber: created.currentRevisionNumber,
            planningDepth: 'advanced',
            itemDescriptions: ['Inspect the current planning surface.'],
        });

        const upgraded = await planStore.enterAdvancedPlanning(created.id, advancedSnapshot);
        expect(upgraded?.planningDepth).toBe('advanced');
        expect(upgraded?.currentRevisionNumber).toBe(2);
        expect(upgraded?.advancedSnapshot?.evidenceMarkdown).toContain('Plan State');
        expect(upgraded?.status).toBe('draft');

        const loaded = await planStore.getById('profile_default', created.id);
        expect(loaded?.planningDepth).toBe('advanced');
        expect(loaded?.currentRevisionNumber).toBe(2);
        expect(loaded?.advancedSnapshot?.phases.length).toBeGreaterThanOrEqual(2);
    });
});
