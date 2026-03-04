import { modeStore } from '@/app/backend/persistence/stores';
import { agentModes, orchestratorModes } from '@/app/backend/runtime/contracts';
import type { ModeDefinition, TopLevelTab } from '@/app/backend/runtime/contracts';

interface ResolveModeExecutionInput {
    profileId: string;
    topLevelTab: TopLevelTab;
    modeKey: string;
}

export interface ResolvedModeExecution {
    mode: ModeDefinition;
}

function isAllowedModeForTab(topLevelTab: TopLevelTab, modeKey: string): boolean {
    if (topLevelTab === 'chat') {
        return modeKey === 'chat';
    }

    if (topLevelTab === 'agent') {
        return (agentModes as readonly string[]).includes(modeKey);
    }

    return (orchestratorModes as readonly string[]).includes(modeKey);
}

export async function resolveModeExecution(input: ResolveModeExecutionInput): Promise<ResolvedModeExecution> {
    if (!isAllowedModeForTab(input.topLevelTab, input.modeKey)) {
        throw new Error(`Mode "${input.modeKey}" is invalid for tab "${input.topLevelTab}".`);
    }

    const mode = await modeStore.getByProfileTabMode(input.profileId, input.topLevelTab, input.modeKey);
    if (!mode || !mode.enabled) {
        throw new Error(`Mode "${input.modeKey}" is not available for tab "${input.topLevelTab}".`);
    }

    if (mode.executionPolicy.planningOnly) {
        throw new Error(`Mode "${input.modeKey}" is planning-only and cannot execute runs.`);
    }

    if (input.topLevelTab === 'agent' && input.modeKey === 'ask' && !mode.executionPolicy.readOnly) {
        throw new Error('agent.ask must be configured with a read-only execution policy.');
    }

    if (input.topLevelTab === 'agent' && input.modeKey !== 'ask' && mode.executionPolicy.readOnly) {
        throw new Error(`Mode "${input.modeKey}" cannot run with a read-only execution policy.`);
    }

    return { mode };
}
