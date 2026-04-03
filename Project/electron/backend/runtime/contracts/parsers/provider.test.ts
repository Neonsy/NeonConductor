import { describe, expect, it } from 'vitest';

import {
    parseProviderClearWorkflowRoutingPreferenceInput,
    parseProviderSetWorkflowRoutingPreferenceInput,
} from '@/app/backend/runtime/contracts/parsers/provider';

describe('provider contract parsers', () => {
    it('parses workflow routing preference inputs', () => {
        expect(
            parseProviderSetWorkflowRoutingPreferenceInput({
                profileId: 'profile_default',
                targetKey: 'planning',
                providerId: 'openai',
                modelId: 'openai/gpt-5',
            })
        ).toEqual({
            profileId: 'profile_default',
            targetKey: 'planning',
            providerId: 'openai',
            modelId: 'openai/gpt-5',
        });

        expect(
            parseProviderClearWorkflowRoutingPreferenceInput({
                profileId: 'profile_default',
                targetKey: 'planning_advanced',
            })
        ).toEqual({
            profileId: 'profile_default',
            targetKey: 'planning_advanced',
        });
    });

    it('fails closed for unknown workflow routing targets', () => {
        expect(() =>
            parseProviderSetWorkflowRoutingPreferenceInput({
                profileId: 'profile_default',
                targetKey: 'review',
                providerId: 'openai',
                modelId: 'openai/gpt-5',
            })
        ).toThrow('Invalid "targetKey": expected one of planning, planning_advanced.');

        expect(() =>
            parseProviderClearWorkflowRoutingPreferenceInput({
                profileId: 'profile_default',
                targetKey: 'review',
            })
        ).toThrow('Invalid "targetKey": expected one of planning, planning_advanced.');
    });
});
