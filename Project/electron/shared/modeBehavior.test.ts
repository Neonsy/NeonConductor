import { describe, expect, it } from 'vitest';

import type { BehaviorFlag, ToolCapability, WorkflowCapability } from '@/shared/contracts';
import {
    getModeBehaviorFlags,
    getModeToolCapabilities,
    getModeWorkflowCapabilities,
    modeAllowsToolCapabilities,
    modeCanExecuteRuns,
    modeIsCheckpointEligible,
    modeMutatesWorkspace,
    modeRequiresNativeTools,
    modeShowsPlanArtifactSurface,
    modeSupportsOrchestrationWorkflow,
    modeSupportsPlanningWorkflow,
    modeUsesReadOnlyExecution,
} from '@/shared/modeBehavior';

function buildMode(input?: {
    topLevelTab?: 'chat' | 'agent' | 'orchestrator';
    modeKey?: string;
    planningOnly?: boolean;
    toolCapabilities?: ToolCapability[];
    workflowCapabilities?: WorkflowCapability[];
    behaviorFlags?: BehaviorFlag[];
}): {
    topLevelTab: 'chat' | 'agent' | 'orchestrator';
    modeKey: string;
    executionPolicy: {
        planningOnly?: boolean;
        toolCapabilities?: ToolCapability[];
        workflowCapabilities?: WorkflowCapability[];
        behaviorFlags?: BehaviorFlag[];
    };
} {
    return {
        topLevelTab: input?.topLevelTab ?? 'agent',
        modeKey: input?.modeKey ?? 'custom_mode',
        executionPolicy: {
            ...(input?.planningOnly ? { planningOnly: true } : {}),
            ...(input?.toolCapabilities ? { toolCapabilities: input.toolCapabilities } : {}),
            ...(input?.workflowCapabilities ? { workflowCapabilities: input.workflowCapabilities } : {}),
            ...(input?.behaviorFlags ? { behaviorFlags: input.behaviorFlags } : {}),
        },
    };
}

describe('modeBehavior', () => {
    it('derives capability metadata without duplicating repeated values', () => {
        const mode = buildMode({
            toolCapabilities: ['filesystem_read', 'shell', 'filesystem_read'],
            workflowCapabilities: ['planning', 'artifact_view', 'planning'],
            behaviorFlags: ['approval_gated', 'artifact_producing', 'approval_gated'],
        });

        expect(getModeToolCapabilities(mode.executionPolicy)).toEqual(['filesystem_read', 'shell']);
        expect(getModeWorkflowCapabilities(mode.executionPolicy)).toEqual(['planning', 'artifact_view']);
        expect(getModeBehaviorFlags(mode.executionPolicy)).toEqual(['approval_gated', 'artifact_producing']);
        expect(modeAllowsToolCapabilities(mode, ['filesystem_read'])).toBe(true);
        expect(modeAllowsToolCapabilities(mode, ['filesystem_write'])).toBe(false);
    });

    it('keeps planningOnly as a compatibility fallback for legacy planning modes', () => {
        const mode = buildMode({
            modeKey: 'plan',
            planningOnly: true,
            toolCapabilities: ['filesystem_read', 'shell'],
        });

        expect(modeSupportsPlanningWorkflow(mode)).toBe(true);
        expect(modeUsesReadOnlyExecution(mode)).toBe(true);
        expect(modeCanExecuteRuns(mode)).toBe(false);
        expect(modeRequiresNativeTools(mode)).toBe(false);
    });

    it('treats planning workflow and read-only execution as separate declarations for new modes', () => {
        const mode = buildMode({
            workflowCapabilities: ['planning'],
            toolCapabilities: ['filesystem_read', 'shell'],
        });

        expect(modeSupportsPlanningWorkflow(mode)).toBe(true);
        expect(modeUsesReadOnlyExecution(mode)).toBe(true);
        expect(modeCanExecuteRuns(mode)).toBe(false);
        expect(modeRequiresNativeTools(mode)).toBe(false);
    });

    it('treats orchestration and checkpoint mutability as separate declarative behaviors', () => {
        const mode = buildMode({
            topLevelTab: 'orchestrator',
            modeKey: 'workspace_orchestrator',
            toolCapabilities: ['filesystem_read', 'shell'],
            workflowCapabilities: ['orchestration', 'artifact_view'],
            behaviorFlags: ['checkpoint_eligible', 'workspace_mutating'],
        });

        expect(modeSupportsPlanningWorkflow(mode)).toBe(false);
        expect(modeSupportsOrchestrationWorkflow(mode)).toBe(true);
        expect(modeShowsPlanArtifactSurface(mode)).toBe(true);
        expect(modeIsCheckpointEligible(mode)).toBe(true);
        expect(modeMutatesWorkspace(mode)).toBe(true);
        expect(modeRequiresNativeTools(mode)).toBe(true);
    });
});
