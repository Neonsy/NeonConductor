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
    }),
}));

import { KiloModesInstructionsScreen } from '@/web/components/settings/kiloPromptLayers/modesInstructionsScreen';

describe('kilo modes and instructions screen', () => {
    it('renders editable app, profile, and built-in top-level instruction sections with warning copy', () => {
        const html = renderToStaticMarkup(createElement(KiloModesInstructionsScreen, { profileId: 'profile_default' }));

        expect(html).toContain('Modes &amp; Instructions');
        expect(html).toContain('App-Scope Global Instructions');
        expect(html).toContain('Profile-Scope Global Instructions');
        expect(html).toContain('Chat Instructions');
        expect(html).toContain('Agent Instructions');
        expect(html).toContain('Orchestrator Instructions');
        expect(html).toContain('Editing built-in chat instructions can make the app behave differently');
        expect(html).toContain('Reset');
        expect(html).toContain('Save');
    });
});
