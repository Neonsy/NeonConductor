import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/web/components/settings/kiloPromptLayers/useKiloPromptLayerSettingsController', () => ({
    useKiloPromptLayerSettingsController: () => ({
        feedback: {
            message: undefined,
            tone: 'info',
            clear: vi.fn(),
        },
        query: {
            isLoading: false,
            data: {
                settings: {
                    appGlobalInstructions: '',
                    profileGlobalInstructions: '',
                    topLevelInstructions: {
                        chat: '',
                        agent: '',
                        orchestrator: '',
                    },
                    builtInModes: {
                        chat: [
                            {
                                topLevelTab: 'chat',
                                modeKey: 'chat',
                                label: 'Chat',
                                prompt: {},
                                hasOverride: false,
                            },
                        ],
                        agent: [
                            {
                                topLevelTab: 'agent',
                                modeKey: 'code',
                                label: 'Agent Code',
                                prompt: {
                                    roleDefinition: '',
                                    customInstructions: '',
                                },
                                hasOverride: false,
                            },
                        ],
                        orchestrator: [
                            {
                                topLevelTab: 'orchestrator',
                                modeKey: 'orchestrate',
                                label: 'Orchestrator Orchestrate',
                                prompt: {},
                                hasOverride: false,
                            },
                        ],
                    },
                },
            },
        },
        appGlobal: {
            value: '',
            isSaving: false,
            setValue: vi.fn(),
            save: vi.fn(),
            reset: vi.fn(),
        },
        profileGlobal: {
            value: '',
            isSaving: false,
            setValue: vi.fn(),
            save: vi.fn(),
            reset: vi.fn(),
        },
        topLevel: {
            isSaving: false,
            getValue: () => '',
            setValue: vi.fn(),
            save: vi.fn(),
            reset: vi.fn(),
        },
        builtInModes: {
            isSaving: false,
            getItems: (topLevelTab: 'chat' | 'agent' | 'orchestrator') =>
                topLevelTab === 'chat'
                    ? [
                          {
                              topLevelTab: 'chat',
                              modeKey: 'chat',
                              label: 'Chat',
                              prompt: {
                                  roleDefinition: '',
                                  customInstructions: '',
                              },
                              hasOverride: false,
                          },
                      ]
                    : topLevelTab === 'agent'
                      ? [
                            {
                                topLevelTab: 'agent',
                                modeKey: 'code',
                                label: 'Agent Code',
                                prompt: {
                                    roleDefinition: '',
                                    customInstructions: '',
                                },
                                hasOverride: false,
                            },
                        ]
                      : [
                            {
                                topLevelTab: 'orchestrator',
                                modeKey: 'orchestrate',
                                label: 'Orchestrator Orchestrate',
                                prompt: {
                                    roleDefinition: '',
                                    customInstructions: '',
                                },
                                hasOverride: false,
                            },
                        ],
            setPromptField: vi.fn(),
            save: vi.fn(),
            reset: vi.fn(),
        },
    }),
}));

import { KiloModesInstructionsScreen } from '@/web/components/settings/kiloPromptLayers/modesInstructionsScreen';

describe('kilo modes and instructions screen', () => {
    it('renders editable app, profile, top-level, and built-in mode prompt sections with warning copy', () => {
        const html = renderToStaticMarkup(createElement(KiloModesInstructionsScreen, { profileId: 'profile_default' }));

        expect(html).toContain('Modes &amp; Instructions');
        expect(html).toContain('App-Scope Global Instructions');
        expect(html).toContain('Profile-Scope Global Instructions');
        expect(html).toContain('Chat Instructions');
        expect(html).toContain('Agent Instructions');
        expect(html).toContain('Orchestrator Instructions');
        expect(html).toContain('Editing built-in chat instructions can make the app behave differently');
        expect(html).toContain('Built-In Mode Prompts');
        expect(html).toContain('Agent Code');
        expect(html).toContain('Orchestrator Orchestrate');
        expect(html).toContain('Editing the built-in agent code prompt can make the app behave unexpectedly');
        expect(html).toContain('Role Definition');
        expect(html).toContain('Custom Instructions');
        expect(html).toContain('Reset');
        expect(html).toContain('Save');
    });
});
