import type { ModeDefinition, RuntimeRequirementProfile } from '@/shared/contracts';
import { isSupportedProviderSpecialistDefaultTarget } from '@/shared/contracts';
import type {
    ProviderSpecialistDefaultLike,
    ProviderSpecialistDefaultModeKey,
    ProviderSpecialistDefaultTopLevelTab,
} from '@/shared/contracts/specialistDefaults';
import type { KiloModeHeader } from '@/shared/kiloModels';
import {
    getModeInternalModelRole,
    getModeRuntimeProfile,
    modeCanExecuteRuns,
    modeRequiresNativeTools,
} from '@/shared/modeBehavior';

type ModeLike = Pick<ModeDefinition, 'topLevelTab' | 'modeKey' | 'executionPolicy'>;

export interface ModeSpecialistAlias {
    topLevelTab: ProviderSpecialistDefaultTopLevelTab;
    modeKey: ProviderSpecialistDefaultModeKey;
}

export interface ModeCompatibilityRequirements {
    runtimeProfile?: RuntimeRequirementProfile;
    requiresNativeTools: boolean;
    allowsImageAttachments: boolean;
}

export interface ModeRoutingIntent extends ModeCompatibilityRequirements {
    specialistAlias?: ModeSpecialistAlias;
    kiloModeHeader?: KiloModeHeader;
}

function runtimeProfileRequiresNativeTools(
    runtimeProfile: RuntimeRequirementProfile | undefined
): boolean | undefined {
    if (!runtimeProfile) {
        return undefined;
    }

    if (
        runtimeProfile === 'read_only_agent' ||
        runtimeProfile === 'mutating_agent' ||
        runtimeProfile === 'orchestrator'
    ) {
        return true;
    }

    return false;
}

function specialistAliasToKiloModeHeader(alias: ModeSpecialistAlias | undefined): KiloModeHeader | undefined {
    if (!alias) {
        return undefined;
    }

    if (alias.topLevelTab === 'agent') {
        return alias.modeKey === 'ask' || alias.modeKey === 'code' || alias.modeKey === 'debug'
            ? alias.modeKey
            : undefined;
    }

    return alias.modeKey === 'orchestrate' ? 'orchestrator' : 'debug';
}

export function isSupportedModeSpecialistAlias(
    input: ProviderSpecialistDefaultLike
): input is ModeSpecialistAlias {
    return isSupportedProviderSpecialistDefaultTarget(input);
}

export function resolveModeSpecialistAlias(mode: ModeLike | undefined): ModeSpecialistAlias | undefined {
    if (!mode) {
        return undefined;
    }

    const candidate = {
        topLevelTab: mode.topLevelTab,
        modeKey: mode.modeKey,
    };
    return isSupportedModeSpecialistAlias(candidate) ? candidate : undefined;
}

export function resolveSpecialistAliasRoutingIntent(alias: ModeSpecialistAlias): ModeRoutingIntent {
    const runtimeProfile: RuntimeRequirementProfile =
        alias.topLevelTab === 'orchestrator'
            ? 'orchestrator'
            : alias.modeKey === 'ask'
              ? 'read_only_agent'
              : 'mutating_agent';
    const kiloModeHeader = specialistAliasToKiloModeHeader(alias);

    return {
        runtimeProfile,
        requiresNativeTools: true,
        allowsImageAttachments: alias.topLevelTab !== 'orchestrator',
        specialistAlias: alias,
        ...(kiloModeHeader ? { kiloModeHeader } : {}),
    };
}

export function resolveModeCompatibilityRequirements(mode: ModeLike | undefined): ModeCompatibilityRequirements {
    const runtimeProfile = mode ? getModeRuntimeProfile(mode.executionPolicy) : undefined;
    const internalModelRole = mode ? getModeInternalModelRole(mode.executionPolicy) : undefined;
    const explicitNativeToolRequirement = runtimeProfileRequiresNativeTools(runtimeProfile);
    const requiresNativeTools =
        explicitNativeToolRequirement !== undefined
            ? explicitNativeToolRequirement
            : modeRequiresNativeTools(mode);

    return {
        ...(runtimeProfile ? { runtimeProfile } : {}),
        requiresNativeTools: internalModelRole === 'chat' ? false : requiresNativeTools,
        allowsImageAttachments: Boolean(mode && modeCanExecuteRuns(mode) && mode.topLevelTab !== 'orchestrator'),
    };
}

export function resolveModeRoutingIntent(mode: ModeLike | undefined): ModeRoutingIntent {
    if (!mode) {
        return {
            requiresNativeTools: false,
            allowsImageAttachments: false,
        };
    }

    const specialistAlias = resolveModeSpecialistAlias(mode);
    const compatibilityRequirements = resolveModeCompatibilityRequirements(mode);
    const kiloModeHeader =
        mode.topLevelTab === 'chat' && mode.modeKey === 'chat'
            ? 'general'
            : specialistAliasToKiloModeHeader(specialistAlias);

    return {
        ...compatibilityRequirements,
        ...(specialistAlias ? { specialistAlias } : {}),
        ...(kiloModeHeader ? { kiloModeHeader } : {}),
    };
}
