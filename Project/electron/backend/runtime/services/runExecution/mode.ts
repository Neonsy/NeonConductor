import { modeStore } from '@/app/backend/persistence/stores';
import { agentModes, orchestratorModes } from '@/app/backend/runtime/contracts';
import type { ModeDefinition, TopLevelTab } from '@/app/backend/runtime/contracts';
import {
    errRunExecution,
    okRunExecution,
    type RunExecutionResult,
} from '@/app/backend/runtime/services/runExecution/errors';

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

export async function resolveModeExecution(
    input: ResolveModeExecutionInput
): Promise<RunExecutionResult<ResolvedModeExecution>> {
    if (!isAllowedModeForTab(input.topLevelTab, input.modeKey)) {
        return errRunExecution('invalid_mode', `Mode "${input.modeKey}" is invalid for tab "${input.topLevelTab}".`);
    }

    const mode = await modeStore.getByProfileTabMode(input.profileId, input.topLevelTab, input.modeKey);
    if (!mode || !mode.enabled) {
        return errRunExecution(
            'mode_not_available',
            `Mode "${input.modeKey}" is not available for tab "${input.topLevelTab}".`
        );
    }

    if (mode.executionPolicy.planningOnly) {
        return errRunExecution(
            'mode_policy_invalid',
            `Mode "${input.modeKey}" is planning-only and cannot execute runs.`
        );
    }

    if (input.topLevelTab === 'agent' && input.modeKey === 'ask' && !mode.executionPolicy.readOnly) {
        return errRunExecution(
            'mode_policy_invalid',
            'agent.ask must be configured with a read-only execution policy.'
        );
    }

    if (input.topLevelTab === 'agent' && input.modeKey !== 'ask' && mode.executionPolicy.readOnly) {
        return errRunExecution(
            'mode_policy_invalid',
            `Mode "${input.modeKey}" cannot run with a read-only execution policy.`
        );
    }

    return okRunExecution({ mode });
}
