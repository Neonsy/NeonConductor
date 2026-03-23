import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/web/components/settings/modesSettings/useModesInstructionsSettingsController', () => ({
    useModesInstructionsSettingsController: () => ({
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
                    fileBackedCustomModes: {
                        global: {
                            chat: [
                                {
                                    topLevelTab: 'chat',
                                    modeKey: 'review',
                                    label: 'Global Chat Review',
                                    description: 'Global chat review mode',
                                    whenToUse: 'Use when a conversation needs a strict review pass.',
                                    tags: ['quality', 'review'],
                                    toolCapabilities: ['filesystem_read', 'shell'],
                                },
                            ],
                            agent: [],
                            orchestrator: [],
                        },
                        workspace: {
                            chat: [],
                            agent: [],
                            orchestrator: [
                                {
                                    topLevelTab: 'orchestrator',
                                    modeKey: 'workspace-orchestrator',
                                    label: 'Workspace Orchestrator',
                                    description: 'Workspace orchestrator mode',
                                    whenToUse: 'Use when a workspace needs coordination.',
                                    toolCapabilities: ['filesystem_read', 'filesystem_write'],
                                },
                            ],
                        },
                    },
                },
            },
        },
        workspace: {
            fingerprint: 'wsf_modes_screen',
            selectedLabel: 'Workspace Root',
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
        customModes: {
            global: {
                chat: [
                    {
                        topLevelTab: 'chat',
                        modeKey: 'review',
                        label: 'Global Chat Review',
                        description: 'Global chat review mode',
                        whenToUse: 'Use when a conversation needs a strict review pass.',
                        tags: ['quality', 'review'],
                        toolCapabilities: ['filesystem_read', 'shell'],
                    },
                ],
                agent: [],
                orchestrator: [],
            },
            workspace: {
                chat: [],
                agent: [],
                orchestrator: [
                    {
                        topLevelTab: 'orchestrator',
                        modeKey: 'workspace-orchestrator',
                        label: 'Workspace Orchestrator',
                        description: 'Workspace orchestrator mode',
                        whenToUse: 'Use when a workspace needs coordination.',
                        toolCapabilities: ['filesystem_read', 'filesystem_write'],
                    },
                ],
            },
            editor: {
                draft: {
                    kind: 'edit',
                    scope: 'global',
                    topLevelTab: 'chat',
                    modeKey: 'review',
                    slug: 'review',
                    name: 'Global Chat Review',
                    description: 'Global chat review mode',
                    roleDefinition: 'Act as a precise reviewer.',
                    customInstructions: 'Review the active conversation carefully.',
                    whenToUse: 'Use when a conversation needs a strict review pass.',
                    tagsText: 'quality, review',
                    selectedToolCapabilities: ['filesystem_read', 'shell'],
                    deleteConfirmed: false,
                },
                isLoading: false,
                isSaving: false,
                hasWorkspaceScope: true,
                selectedWorkspaceLabel: 'Workspace Root',
                openCreate: vi.fn(),
                openEdit: vi.fn(),
                openDelete: vi.fn(),
                close: vi.fn(),
                setScope: vi.fn(),
                setTopLevelTab: vi.fn(),
                setField: vi.fn(),
                toggleToolCapability: vi.fn(),
                setDeleteConfirmed: vi.fn(),
                save: vi.fn(),
                deleteMode: vi.fn(),
            },
            importDraft: {
                jsonText: '',
                scope: 'global',
                topLevelTab: 'chat',
                allowOverwrite: false,
                hasWorkspaceScope: true,
                selectedWorkspaceLabel: 'Workspace Root',
            },
            exportState: {
                jsonText: '',
                selectedLabel: undefined,
            },
            isImporting: false,
            isExporting: false,
            setImportJsonText: vi.fn(),
            setImportScope: vi.fn(),
            setImportTopLevelTab: vi.fn(),
            setAllowOverwrite: vi.fn(),
            importMode: vi.fn(),
            exportMode: vi.fn(),
            copyExportJson: vi.fn(),
        },
    }),
}));

import { ModesInstructionsScreen } from '@/web/components/settings/modesSettings/modesInstructionsScreen';

describe('modes instructions screen', () => {
    it('renders app-level prompt layers, built-in overrides, and portable custom mode controls', () => {
        const html = renderToStaticMarkup(
            createElement(ModesInstructionsScreen, {
                profileId: 'profile_default',
                workspaceFingerprint: 'wsf_modes_screen',
                selectedWorkspaceLabel: 'Workspace Root',
            })
        );

        expect(html).toContain('Modes &amp; Instructions');
        expect(html).toContain('App-Level Modes');
        expect(html).toContain('App-Scope Global Instructions');
        expect(html).toContain('Profile-Scope Global Instructions');
        expect(html).toContain('Built-In Mode Prompts');
        expect(html).toContain('Agent Code');
        expect(html).toContain('Import Portable Mode JSON');
        expect(html).toContain('Export Portable Mode JSON');
        expect(html).toContain('Create Global Mode');
        expect(html).toContain('Create Workspace Mode');
        expect(html).toContain('Edit File-Backed Custom Mode');
        expect(html).toContain('Global Chat Review');
        expect(html).toContain('Workspace Orchestrator');
        expect(html).toContain('Use when a conversation needs a strict review pass.');
        expect(html).toContain('quality');
        expect(html).toContain('Filesystem Read');
        expect(html).toContain('Shell');
        expect(html).toContain('Delete This Mode');
        expect(html).toContain('Edit');
        expect(html).toContain('Delete');
        expect(html).toContain('Import will write into the global');
        expect(html).toContain('Copy JSON');
    });
});
