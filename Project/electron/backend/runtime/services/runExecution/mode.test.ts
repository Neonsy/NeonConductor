import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    resolveModesForTab: vi.fn(),
}));

vi.mock('@/app/backend/runtime/services/registry/service', () => ({
    resolveModesForTab: mocks.resolveModesForTab,
}));

import { resolveModeExecution } from '@/app/backend/runtime/services/runExecution/mode';

function buildMode(input: {
    modeKey: string;
    workflowCapabilities?: string[];
}): {
    id: string;
    profileId: string;
    topLevelTab: 'agent' | 'orchestrator';
    modeKey: string;
    authoringRole: 'single_task_agent';
    roleTemplate: 'single_task_agent/apply' | 'single_task_agent/plan';
    internalModelRole: 'apply' | 'planner';
    delegatedOnly: false;
    sessionSelectable: true;
    label: string;
    assetKey: string;
    prompt: Record<string, never>;
    executionPolicy: {
        authoringRole: 'single_task_agent';
        roleTemplate: 'single_task_agent/apply' | 'single_task_agent/plan';
        internalModelRole: 'apply' | 'planner';
        delegatedOnly: false;
        sessionSelectable: true;
        workflowCapabilities?: string[];
    };
    source: string;
    sourceKind: 'system_seed';
    scope: 'system';
    enabled: boolean;
    precedence: number;
    createdAt: string;
    updatedAt: string;
} {
    return {
        id: `mode_${input.modeKey}`,
        profileId: 'profile_default',
        topLevelTab: 'agent',
        modeKey: input.modeKey,
        authoringRole: 'single_task_agent',
        roleTemplate: input.workflowCapabilities?.includes('planning')
            ? 'single_task_agent/plan'
            : 'single_task_agent/apply',
        internalModelRole: input.workflowCapabilities?.includes('planning') ? 'planner' : 'apply',
        delegatedOnly: false,
        sessionSelectable: true,
        label: input.modeKey,
        assetKey: `agent.${input.modeKey}`,
        prompt: {},
        executionPolicy: {
            authoringRole: 'single_task_agent',
            roleTemplate: input.workflowCapabilities?.includes('planning')
                ? 'single_task_agent/plan'
                : 'single_task_agent/apply',
            internalModelRole: input.workflowCapabilities?.includes('planning') ? 'planner' : 'apply',
            delegatedOnly: false,
            sessionSelectable: true,
            ...(input.workflowCapabilities ? { workflowCapabilities: input.workflowCapabilities } : {}),
        },
        source: 'test',
        sourceKind: 'system_seed',
        scope: 'system',
        enabled: true,
        precedence: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
    };
}

describe('resolveModeExecution', () => {
    beforeEach(() => {
        mocks.resolveModesForTab.mockReset();
    });

    it('rejects planning-capable modes from ordinary run execution', async () => {
        mocks.resolveModesForTab.mockResolvedValue([buildMode({ modeKey: 'custom_plan', workflowCapabilities: ['planning'] })]);

        const result = await resolveModeExecution({
            profileId: 'profile_default',
            topLevelTab: 'agent',
            modeKey: 'custom_plan',
        });

        expect(result.isErr()).toBe(true);
        expect(result._unsafeUnwrapErr().code).toBe('mode_policy_invalid');
    });

    it('allows ordinary non-planning modes to resolve for runs', async () => {
        mocks.resolveModesForTab.mockResolvedValue([buildMode({ modeKey: 'custom_code' })]);

        const result = await resolveModeExecution({
            profileId: 'profile_default',
            topLevelTab: 'agent',
            modeKey: 'custom_code',
        });

        expect(result.isOk()).toBe(true);
    });
});
