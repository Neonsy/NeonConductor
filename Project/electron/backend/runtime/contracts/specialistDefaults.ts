import type { RuntimeProviderId } from '@/shared/contracts';

export const providerSpecialistDefaultTargets = [
    {
        topLevelTab: 'agent',
        modeKey: 'ask',
        label: 'Ask',
        groupLabel: 'Agent',
    },
    {
        topLevelTab: 'agent',
        modeKey: 'code',
        label: 'Code',
        groupLabel: 'Agent',
    },
    {
        topLevelTab: 'agent',
        modeKey: 'debug',
        label: 'Debug',
        groupLabel: 'Agent',
    },
    {
        topLevelTab: 'orchestrator',
        modeKey: 'orchestrate',
        label: 'Orchestrate',
        groupLabel: 'Orchestrator',
    },
    {
        topLevelTab: 'orchestrator',
        modeKey: 'debug',
        label: 'Debug',
        groupLabel: 'Orchestrator',
    },
] as const;

export type ProviderSpecialistDefaultTarget = (typeof providerSpecialistDefaultTargets)[number];
export type ProviderSpecialistDefaultModeKey = ProviderSpecialistDefaultTarget['modeKey'];
export type ProviderSpecialistDefaultTopLevelTab = ProviderSpecialistDefaultTarget['topLevelTab'];

export interface ProviderSpecialistDefaultLike {
    topLevelTab: string;
    modeKey: string;
}

export interface ProviderSpecialistDefaultRecordLike extends ProviderSpecialistDefaultLike {
    providerId: RuntimeProviderId;
    modelId: string;
}

export function getProviderSpecialistDefaultKey(input: ProviderSpecialistDefaultLike): string {
    return `${input.topLevelTab}:${input.modeKey}`;
}

const providerSpecialistDefaultKeySet = new Set(
    providerSpecialistDefaultTargets.map((target) => getProviderSpecialistDefaultKey(target))
);

export function isSupportedProviderSpecialistDefaultTarget(
    input: ProviderSpecialistDefaultLike
): input is ProviderSpecialistDefaultTarget {
    return providerSpecialistDefaultKeySet.has(getProviderSpecialistDefaultKey(input));
}

export function findProviderSpecialistDefault(
    defaults: ProviderSpecialistDefaultRecordLike[],
    input: ProviderSpecialistDefaultLike
): ProviderSpecialistDefaultRecordLike | undefined {
    const targetKey = getProviderSpecialistDefaultKey(input);
    return defaults.find((value) => getProviderSpecialistDefaultKey(value) === targetKey);
}
