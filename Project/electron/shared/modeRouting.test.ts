import { describe, expect, it } from 'vitest';

import type { ModeDefinition } from '@/shared/contracts';
import {
    isSupportedModeSpecialistAlias,
    resolveModeCompatibilityRequirements,
    resolveModeRoutingIntent,
    resolveModeSpecialistAlias,
    resolveSpecialistAliasRoutingIntent,
} from '@/shared/modeRouting';

function createMode(input: {
    topLevelTab: ModeDefinition['topLevelTab'];
    modeKey: string;
    runtimeProfile?: ModeDefinition['executionPolicy']['runtimeProfile'];
    planningOnly?: boolean;
    toolCapabilities?: ModeDefinition['executionPolicy']['toolCapabilities'];
}): ModeDefinition {
    return {
        id: `mode_${input.topLevelTab}_${input.modeKey}`,
        profileId: 'profile_default',
        topLevelTab: input.topLevelTab,
        modeKey: input.modeKey,
        label: input.modeKey,
        assetKey: `${input.topLevelTab}.${input.modeKey}`,
        prompt: {},
        executionPolicy: {
            ...(input.runtimeProfile ? { runtimeProfile: input.runtimeProfile } : {}),
            ...(input.planningOnly ? { planningOnly: true } : {}),
            ...(input.toolCapabilities ? { toolCapabilities: input.toolCapabilities } : {}),
        },
        source: 'test',
        sourceKind: 'system_seed',
        scope: 'system',
        enabled: true,
        precedence: 0,
        createdAt: '2026-04-02T00:00:00.000Z',
        updatedAt: '2026-04-02T00:00:00.000Z',
    };
}

describe('mode routing intent', () => {
    it('maps built-in runnable presets onto specialist aliases and Kilo headers', () => {
        const codeMode = createMode({
            topLevelTab: 'agent',
            modeKey: 'code',
            runtimeProfile: 'mutating_agent',
        });

        expect(resolveModeSpecialistAlias(codeMode)).toEqual({
            topLevelTab: 'agent',
            modeKey: 'code',
        });
        expect(resolveModeRoutingIntent(codeMode)).toMatchObject({
            runtimeProfile: 'mutating_agent',
            requiresNativeTools: true,
            allowsImageAttachments: true,
            specialistAlias: {
                topLevelTab: 'agent',
                modeKey: 'code',
            },
            kiloModeHeader: 'code',
        });
    });

    it('fails closed for custom modes without a supported preset alias', () => {
        const customMode = createMode({
            topLevelTab: 'agent',
            modeKey: 'custom_review',
            runtimeProfile: 'mutating_agent',
        });

        expect(resolveModeSpecialistAlias(customMode)).toBeUndefined();
        expect(resolveModeRoutingIntent(customMode)).toMatchObject({
            runtimeProfile: 'mutating_agent',
            requiresNativeTools: true,
            allowsImageAttachments: true,
        });
        expect(resolveModeRoutingIntent(customMode).specialistAlias).toBeUndefined();
        expect(resolveModeRoutingIntent(customMode).kiloModeHeader).toBeUndefined();
    });

    it('keeps planning modes out of specialist routing and image attachments', () => {
        const planMode = createMode({
            topLevelTab: 'agent',
            modeKey: 'plan',
            runtimeProfile: 'planner',
            planningOnly: true,
        });

        expect(resolveModeRoutingIntent(planMode)).toEqual({
            runtimeProfile: 'planner',
            requiresNativeTools: false,
            allowsImageAttachments: false,
        });
    });

    it('uses runtimeProfile as the authoritative native-tool requirement when available', () => {
        const generalMode = createMode({
            topLevelTab: 'agent',
            modeKey: 'custom_general',
            runtimeProfile: 'general',
            toolCapabilities: ['filesystem_read', 'shell'],
        });

        expect(resolveModeCompatibilityRequirements(generalMode)).toEqual({
            runtimeProfile: 'general',
            requiresNativeTools: false,
            allowsImageAttachments: true,
        });
    });

    it('keeps a narrow fallback for supported legacy specialist aliases', () => {
        expect(
            isSupportedModeSpecialistAlias({
                topLevelTab: 'orchestrator',
                modeKey: 'orchestrate',
            })
        ).toBe(true);

        expect(
            resolveSpecialistAliasRoutingIntent({
                topLevelTab: 'orchestrator',
                modeKey: 'orchestrate',
            })
        ).toEqual({
            runtimeProfile: 'orchestrator',
            requiresNativeTools: true,
            allowsImageAttachments: false,
            specialistAlias: {
                topLevelTab: 'orchestrator',
                modeKey: 'orchestrate',
            },
            kiloModeHeader: 'orchestrator',
        });
    });
});
