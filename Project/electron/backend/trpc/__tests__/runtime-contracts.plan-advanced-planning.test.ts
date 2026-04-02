import { describe, expect, it } from 'vitest';

import {
    createCaller,
    createSessionInScope,
    registerRuntimeContractHooks,
    runtimeContractProfileId,
} from '@/app/backend/trpc/__tests__/runtime-contracts.shared';

registerRuntimeContractHooks();

describe('runtime contracts: advanced planning', () => {
    it('starts an advanced plan with a seeded advanced snapshot', async () => {
        const caller = createCaller();

        const created = await createSessionInScope(caller, runtimeContractProfileId, {
            scope: 'workspace',
            workspaceFingerprint: 'wsf_advanced_start',
            title: 'Advanced planning start thread',
            kind: 'local',
            topLevelTab: 'agent',
        });

        const started = await caller.plan.start({
            profileId: runtimeContractProfileId,
            sessionId: created.session.id,
            topLevelTab: 'agent',
            modeKey: 'plan',
            prompt: 'Draft an advanced planning lane for the plan surface.',
            planningDepth: 'advanced',
            workspaceFingerprint: 'wsf_advanced_start',
        });

        expect(started.plan.planningDepth).toBe('advanced');
        expect(started.plan.advancedSnapshot).toBeDefined();
        expect(started.plan.advancedSnapshot?.evidenceMarkdown).toContain('Source Prompt');
        expect(started.plan.advancedSnapshot?.phases.length).toBeGreaterThanOrEqual(2);
    });

    it('upgrades a simple plan into advanced planning through the router', async () => {
        const caller = createCaller();

        const created = await createSessionInScope(caller, runtimeContractProfileId, {
            scope: 'workspace',
            workspaceFingerprint: 'wsf_advanced_upgrade',
            title: 'Advanced planning upgrade thread',
            kind: 'local',
            topLevelTab: 'agent',
        });

        const started = await caller.plan.start({
            profileId: runtimeContractProfileId,
            sessionId: created.session.id,
            topLevelTab: 'agent',
            modeKey: 'plan',
            prompt: 'Draft a simple plan before upgrading it.',
            workspaceFingerprint: 'wsf_advanced_upgrade',
        });
        expect(started.plan.planningDepth ?? 'simple').toBe('simple');

        const upgraded = await caller.plan.enterAdvancedPlanning({
            profileId: runtimeContractProfileId,
            planId: started.plan.id,
        });

        expect(upgraded.found).toBe(true);
        if (!upgraded.found) {
            throw new Error('Expected a found advanced plan view.');
        }
        expect(upgraded.plan.planningDepth).toBe('advanced');
        expect(upgraded.plan.currentRevisionNumber).toBe(2);
        expect(upgraded.plan.advancedSnapshot).toBeDefined();
        expect(upgraded.plan.advancedSnapshot?.evidenceMarkdown).toContain('Plan State');
    });
});
