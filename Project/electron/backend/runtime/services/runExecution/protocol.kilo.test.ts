import { describe, expect, it } from 'vitest';

import { kiloFrontierModelId } from '@/shared/kiloModels';

import {
    createProtocolRuntimeOptions,
    protocolTestProfileId,
    resolveRuntimeProtocolForTest,
} from './protocol.shared.test';

describe('resolveRuntimeProtocol kilo gateway routing', () => {
    it('rejects OpenAI transport overrides for kilo gateway models', async () => {
        const result = await resolveRuntimeProtocolForTest({
            profileId: protocolTestProfileId,
            providerId: 'kilo',
            modelId: kiloFrontierModelId,
            modelCapabilities: {
                supportsTools: true,
                supportsReasoning: true,
                supportsVision: false,
                supportsAudioInput: false,
                supportsAudioOutput: false,
                toolProtocol: 'kilo_gateway',
                apiFamily: 'kilo_gateway',
                routedApiFamily: 'openai_compatible',
                inputModalities: ['text'],
                outputModalities: ['text'],
            },
            authMethod: 'api_key',
            runtimeOptions: {
                ...createProtocolRuntimeOptions(),
                transport: {
                    family: 'openai_responses',
                },
            },
        });

        expect(result.isErr()).toBe(true);
        if (result.isOk()) {
            throw new Error('Expected Kilo transport override to fail.');
        }
        expect(result.error.code).toBe('runtime_option_invalid');
    });

    it('selects the kilo transport for routed Anthropic gateway models', async () => {
        const result = await resolveRuntimeProtocolForTest({
            profileId: protocolTestProfileId,
            providerId: 'kilo',
            modelId: 'anthropic/claude-sonnet-4.5',
            modelCapabilities: {
                supportsTools: true,
                supportsReasoning: true,
                supportsVision: true,
                supportsAudioInput: false,
                supportsAudioOutput: false,
                toolProtocol: 'kilo_gateway',
                apiFamily: 'kilo_gateway',
                routedApiFamily: 'anthropic_messages',
                inputModalities: ['text', 'image'],
                outputModalities: ['text'],
            },
            authMethod: 'api_key',
            runtimeOptions: createProtocolRuntimeOptions(),
        });

        expect(result.isOk()).toBe(true);
        if (result.isErr()) {
            throw new Error(result.error.message);
        }
        expect(result.value.toolProtocol).toBe('kilo_gateway');
        expect(result.value.routedApiFamily).toBe('anthropic_messages');
        expect(result.value.transport.selected).toBe('kilo_gateway');
    });

    it('fails closed for Kilo gateway models that are missing routed family metadata', async () => {
        const result = await resolveRuntimeProtocolForTest({
            profileId: protocolTestProfileId,
            providerId: 'kilo',
            modelId: kiloFrontierModelId,
            modelCapabilities: {
                supportsTools: true,
                supportsReasoning: true,
                supportsVision: false,
                supportsAudioInput: false,
                supportsAudioOutput: false,
                toolProtocol: 'kilo_gateway',
                apiFamily: 'kilo_gateway',
                inputModalities: ['text'],
                outputModalities: ['text'],
            },
            authMethod: 'api_key',
            runtimeOptions: createProtocolRuntimeOptions(),
        });

        expect(result.isErr()).toBe(true);
        if (result.isOk()) {
            throw new Error('Expected missing Kilo routed family metadata to fail closed.');
        }
        expect(result.error.code).toBe('runtime_option_invalid');
    });

    it('selects the kilo transport for routed Gemini gateway models', async () => {
        const result = await resolveRuntimeProtocolForTest({
            profileId: protocolTestProfileId,
            providerId: 'kilo',
            modelId: 'google/gemini-2.5-pro',
            modelCapabilities: {
                supportsTools: true,
                supportsReasoning: true,
                supportsVision: true,
                supportsAudioInput: false,
                supportsAudioOutput: false,
                toolProtocol: 'kilo_gateway',
                apiFamily: 'kilo_gateway',
                routedApiFamily: 'google_generativeai',
                inputModalities: ['text', 'image'],
                outputModalities: ['text'],
            },
            authMethod: 'api_key',
            runtimeOptions: createProtocolRuntimeOptions(),
        });

        expect(result.isOk()).toBe(true);
        if (result.isErr()) {
            throw new Error(result.error.message);
        }
        expect(result.value.toolProtocol).toBe('kilo_gateway');
        expect(result.value.routedApiFamily).toBe('google_generativeai');
        expect(result.value.transport.selected).toBe('kilo_gateway');
    });
});
