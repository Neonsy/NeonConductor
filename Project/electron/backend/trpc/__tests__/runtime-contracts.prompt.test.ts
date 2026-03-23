import { describe, expect, it } from 'vitest';

import {
    createCaller,
    createSessionInScope,
    getPersistence,
    mkdirSync,
    path,
    readFileSync,
    registerRuntimeContractHooks,
    rmSync,
    runtimeContractProfileId,
    writeFileSync,
} from '@/app/backend/trpc/__tests__/runtime-contracts.shared';

registerRuntimeContractHooks();

describe('runtime contracts: prompt layers', () => {
    const profileId = runtimeContractProfileId;

    it('persists and resets app, profile, and top-level prompt layers', async () => {
        const caller = createCaller();

        const initialSettings = await caller.prompt.getSettings({ profileId });
        expect(initialSettings.settings.appGlobalInstructions).toBe('');
        expect(initialSettings.settings.profileGlobalInstructions).toBe('');
        expect(initialSettings.settings.topLevelInstructions).toEqual({
            chat: '',
            agent: '',
            orchestrator: '',
        });
        expect(initialSettings.settings.fileBackedCustomModes).toEqual({
            global: {
                chat: [],
                agent: [],
                orchestrator: [],
            },
        });
        expect(initialSettings.settings.builtInModes.chat).toEqual([
            {
                topLevelTab: 'chat',
                modeKey: 'chat',
                label: 'Chat',
                prompt: {},
                hasOverride: false,
            },
        ]);
        expect(initialSettings.settings.builtInModes.agent.map((mode) => mode.modeKey)).toEqual([
            'plan',
            'ask',
            'code',
            'debug',
        ]);
        expect(initialSettings.settings.builtInModes.orchestrator.map((mode) => mode.modeKey)).toEqual([
            'plan',
            'orchestrate',
            'debug',
        ]);

        const savedAppSettings = await caller.prompt.setAppGlobalInstructions({
            profileId,
            value: 'Use concise system behavior.',
        });
        expect(savedAppSettings.settings.appGlobalInstructions).toBe('Use concise system behavior.');

        const savedProfileSettings = await caller.prompt.setProfileGlobalInstructions({
            profileId,
            value: 'Bias toward this profile context.',
        });
        expect(savedProfileSettings.settings.profileGlobalInstructions).toBe('Bias toward this profile context.');

        const savedTopLevelSettings = await caller.prompt.setTopLevelInstructions({
            profileId,
            topLevelTab: 'chat',
            value: 'Chat should stay lightweight.',
        });
        expect(savedTopLevelSettings.settings.topLevelInstructions.chat).toBe('Chat should stay lightweight.');

        const resetTopLevelSettings = await caller.prompt.resetTopLevelInstructions({
            profileId,
            topLevelTab: 'chat',
        });
        expect(resetTopLevelSettings.settings.topLevelInstructions.chat).toBe('');

        const savedBuiltInModeSettings = await caller.prompt.setBuiltInModePrompt({
            profileId,
            topLevelTab: 'agent',
            modeKey: 'code',
            roleDefinition: 'Act as the shipped coding specialist.',
            customInstructions: 'Always explain the change plan before editing.',
        });
        expect(savedBuiltInModeSettings.settings.builtInModes.agent.find((mode) => mode.modeKey === 'code')).toEqual({
            topLevelTab: 'agent',
            modeKey: 'code',
            label: 'Agent Code',
            prompt: {
                roleDefinition: 'Act as the shipped coding specialist.',
                customInstructions: 'Always explain the change plan before editing.',
            },
            hasOverride: true,
        });

        const resetBuiltInModeSettings = await caller.prompt.resetBuiltInModePrompt({
            profileId,
            topLevelTab: 'agent',
            modeKey: 'code',
        });
        expect(
            resetBuiltInModeSettings.settings.builtInModes.agent.find((mode) => mode.modeKey === 'code')
        ).toEqual({
            topLevelTab: 'agent',
            modeKey: 'code',
            label: 'Agent Code',
            prompt: {},
            hasOverride: false,
        });

        const resetProfileSettings = await caller.prompt.resetProfileGlobalInstructions({ profileId });
        expect(resetProfileSettings.settings.profileGlobalInstructions).toBe('');

        const resetAppSettings = await caller.prompt.resetAppGlobalInstructions({ profileId });
        expect(resetAppSettings.settings.appGlobalInstructions).toBe('');
    });

    it('fails closed on malformed persisted prompt-layer records', async () => {
        const caller = createCaller();
        const { sqlite } = getPersistence();
        const now = new Date().toISOString();

        sqlite
            .prepare(
                `
                    INSERT OR REPLACE INTO settings (id, profile_id, key, value_json, updated_at)
                    VALUES (?, ?, ?, ?, ?)
                `
            )
            .run('setting_prompt_layer_profile_global_invalid', profileId, 'prompt_layer.profile_global_instructions', '42', now);
        sqlite
            .prepare(
                `
                    INSERT OR REPLACE INTO settings (id, profile_id, key, value_json, updated_at)
                    VALUES (?, ?, ?, ?, ?)
                `
            )
            .run('setting_prompt_layer_top_level_invalid', profileId, 'prompt_layer.top_level.agent', 'false', now);
        sqlite
            .prepare(
                `
                    INSERT OR REPLACE INTO built_in_mode_prompt_overrides
                        (profile_id, top_level_tab, mode_key, prompt_json, updated_at)
                    VALUES (?, ?, ?, ?, ?)
                `
            )
            .run(profileId, 'agent', 'code', '{"roleDefinition":42,"customInstructions":false}', now);
        sqlite
            .prepare(
                `
                    INSERT OR REPLACE INTO app_prompt_layer_settings (id, global_instructions, updated_at)
                    VALUES (?, ?, ?)
                `
            )
            .run('global', '', now);

        const settings = await caller.prompt.getSettings({ profileId });
        expect(settings.settings.appGlobalInstructions).toBe('');
        expect(settings.settings.profileGlobalInstructions).toBe('');
        expect(settings.settings.topLevelInstructions.agent).toBe('');
        expect(settings.settings.builtInModes.agent.find((mode) => mode.modeKey === 'code')).toEqual({
            topLevelTab: 'agent',
            modeKey: 'code',
            label: 'Agent Code',
            prompt: {},
            hasOverride: true,
        });
    });

    it('does not apply built-in overrides to a shadowing custom mode', async () => {
        const caller = createCaller();
        const { sqlite } = getPersistence();
        const now = new Date().toISOString();

        const insertCustomMode = sqlite.prepare(
            `
                INSERT INTO mode_definitions (
                    id, profile_id, top_level_tab, mode_key, label, asset_key, prompt_json,
                    execution_policy_json, source, source_kind, scope, workspace_fingerprint,
                    origin_path, description, tags_json, enabled, precedence, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `
        );

        insertCustomMode.run(
            'mode_custom_agent_code',
            profileId,
            'agent',
            'code',
            'Custom Agent Code',
            'custom_agent_code',
            JSON.stringify({ customInstructions: 'Workspace-owned custom code mode.' }),
            JSON.stringify({ toolCapabilities: ['filesystem_read'] }),
            'user',
            'global_file',
            'global',
            null,
            'C:/registry/modes/code.md',
            'Custom code mode',
            '[]',
            1,
            10,
            now,
            now
        );
        insertCustomMode.run(
            'mode_custom_chat_chat',
            profileId,
            'chat',
            'chat',
            'Custom Chat',
            'custom_chat_chat',
            JSON.stringify({ customInstructions: 'Custom chat mode instructions.' }),
            JSON.stringify({}),
            'user',
            'global_file',
            'global',
            null,
            'C:/registry/modes/chat.md',
            'Custom chat mode',
            '[]',
            1,
            10,
            now,
            now
        );

        await caller.prompt.setBuiltInModePrompt({
            profileId,
            topLevelTab: 'agent',
            modeKey: 'code',
            roleDefinition: 'Built-in role override',
            customInstructions: 'Built-in custom override',
        });
        await caller.prompt.setBuiltInModePrompt({
            profileId,
            topLevelTab: 'chat',
            modeKey: 'chat',
            roleDefinition: 'Built-in chat role override',
            customInstructions: 'Built-in chat custom override',
        });

        const agentModes = await caller.mode.list({
            profileId,
            topLevelTab: 'agent',
        });
        expect(agentModes.modes.find((mode) => mode.modeKey === 'code')).toEqual(
            expect.objectContaining({
                label: 'Custom Agent Code',
                prompt: {
                    customInstructions: 'Workspace-owned custom code mode.',
                },
            })
        );

        const chatModes = await caller.mode.list({
            profileId,
            topLevelTab: 'chat',
        });
        expect(chatModes.modes.find((mode) => mode.modeKey === 'chat')).toEqual(
            expect.objectContaining({
                label: 'Custom Chat',
                prompt: {
                    customInstructions: 'Custom chat mode instructions.',
                },
            })
        );
    });

    it('imports and exports text-based file-backed custom modes without mutating unrelated settings', async () => {
        const caller = createCaller();
        const workspaceFingerprint = 'wsf_prompt_portability';

        await caller.prompt.setBuiltInModePrompt({
            profileId,
            topLevelTab: 'chat',
            modeKey: 'chat',
            roleDefinition: 'Built-in chat role override',
            customInstructions: 'Built-in chat custom override',
        });

        const globalRegistry = await caller.registry.listResolved({ profileId });
        const globalModesRoot = path.join(globalRegistry.paths.globalAssetsRoot, 'modes');
        rmSync(globalModesRoot, { recursive: true, force: true });
        mkdirSync(globalModesRoot, { recursive: true });

        const importedGlobal = await caller.prompt.importCustomMode({
            profileId,
            topLevelTab: 'chat',
            scope: 'global',
            jsonText: JSON.stringify({
                slug: 'review',
                name: 'Portable Review',
                description: 'Global chat review mode',
                roleDefinition: 'Act as a precise reviewer.',
                customInstructions: 'Review the current conversation carefully.',
            }),
            overwrite: false,
        });
        expect(importedGlobal.settings.fileBackedCustomModes.global.chat).toEqual([
            {
                topLevelTab: 'chat',
                modeKey: 'review',
                label: 'Portable Review',
                description: 'Global chat review mode',
            },
        ]);
        expect(
            importedGlobal.settings.builtInModes.chat.find((mode) => mode.modeKey === 'chat')?.prompt
        ).toEqual({
            roleDefinition: 'Built-in chat role override',
            customInstructions: 'Built-in chat custom override',
        });

        const globalModeFile = path.join(globalModesRoot, 'chat-review.md');
        const globalModeMarkdown = readFileSync(globalModeFile, 'utf8');
        expect(globalModeMarkdown).toContain('topLevelTab: chat');
        expect(globalModeMarkdown).toContain('modeKey: review');
        expect(globalModeMarkdown).toContain('roleDefinition: \"Act as a precise reviewer.\"');
        expect(globalModeMarkdown).toContain('Review the current conversation carefully.');

        const exportedGlobal = await caller.prompt.exportCustomMode({
            profileId,
            topLevelTab: 'chat',
            modeKey: 'review',
            scope: 'global',
        });
        expect(JSON.parse(exportedGlobal.jsonText)).toEqual({
            slug: 'review',
            name: 'Portable Review',
            description: 'Global chat review mode',
            roleDefinition: 'Act as a precise reviewer.',
            customInstructions: 'Review the current conversation carefully.',
        });

        await createSessionInScope(caller, profileId, {
            scope: 'workspace',
            workspaceFingerprint,
            title: 'Prompt portability workspace',
            kind: 'local',
            topLevelTab: 'orchestrator',
        });
        const workspaceRegistry = await caller.registry.listResolved({
            profileId,
            workspaceFingerprint,
        });
        const workspaceModesRoot = path.join(workspaceRegistry.paths.workspaceAssetsRoot!, 'modes');
        rmSync(workspaceModesRoot, { recursive: true, force: true });
        mkdirSync(workspaceModesRoot, { recursive: true });

        const importedWorkspace = await caller.prompt.importCustomMode({
            profileId,
            topLevelTab: 'orchestrator',
            scope: 'workspace',
            workspaceFingerprint,
            jsonText: JSON.stringify({
                slug: 'workspace-orchestrator',
                name: 'Workspace Orchestrator',
                customInstructions: 'Coordinate work from the workspace root first.',
            }),
            overwrite: false,
        });
        expect(importedWorkspace.settings.fileBackedCustomModes.workspace?.orchestrator).toEqual([
            {
                topLevelTab: 'orchestrator',
                modeKey: 'workspace-orchestrator',
                label: 'Workspace Orchestrator',
            },
        ]);
        expect(readFileSync(globalModeFile, 'utf8')).toBe(globalModeMarkdown);

        const workspaceModeFile = path.join(workspaceModesRoot, 'orchestrator-workspace-orchestrator.md');
        const workspaceModeMarkdown = readFileSync(workspaceModeFile, 'utf8');
        expect(workspaceModeMarkdown).toContain('topLevelTab: orchestrator');
        expect(workspaceModeMarkdown).toContain('Coordinate work from the workspace root first.');

        const workspaceModes = await caller.mode.list({
            profileId,
            topLevelTab: 'orchestrator',
            workspaceFingerprint,
        });
        expect(
            workspaceModes.modes.find((mode) => mode.modeKey === 'workspace-orchestrator')?.label
        ).toBe('Workspace Orchestrator');
    });

    it('fails closed on unsupported fields and overwrite without explicit confirmation', async () => {
        const caller = createCaller();
        const globalRegistry = await caller.registry.listResolved({ profileId });
        const globalModesRoot = path.join(globalRegistry.paths.globalAssetsRoot, 'modes');
        rmSync(globalModesRoot, { recursive: true, force: true });
        mkdirSync(globalModesRoot, { recursive: true });
        const existingModeFile = path.join(globalModesRoot, 'chat-review.md');

        await caller.prompt.importCustomMode({
            profileId,
            topLevelTab: 'chat',
            scope: 'global',
            jsonText: JSON.stringify({
                slug: 'review',
                name: 'Original Review',
                customInstructions: 'Original instructions.',
            }),
            overwrite: false,
        });
        const initialMarkdown = readFileSync(existingModeFile, 'utf8');

        await expect(
            caller.prompt.importCustomMode({
                profileId,
                topLevelTab: 'chat',
                scope: 'global',
                jsonText: JSON.stringify({
                    slug: 'review',
                    name: 'Replacement Review',
                    customInstructions: 'Replacement instructions.',
                }),
                overwrite: false,
            })
        ).rejects.toThrow('overwrite confirmation');
        expect(readFileSync(existingModeFile, 'utf8')).toBe(initialMarkdown);

        await expect(
            caller.prompt.importCustomMode({
                profileId,
                topLevelTab: 'chat',
                scope: 'global',
                jsonText: JSON.stringify({
                    slug: 'invalid-mode',
                    name: 'Invalid Mode',
                    whenToUse: 'Never silently discard unsupported fields.',
                }),
                overwrite: false,
            })
        ).rejects.toThrow('Unsupported custom mode field "whenToUse"');

        expect(readFileSync(existingModeFile, 'utf8')).toBe(initialMarkdown);
    });

    it('exports a legacy markdown-only custom mode as the supported portable subset without mutation', async () => {
        const caller = createCaller();
        const globalRegistry = await caller.registry.listResolved({ profileId });
        const globalModesRoot = path.join(globalRegistry.paths.globalAssetsRoot, 'modes');
        rmSync(globalModesRoot, { recursive: true, force: true });
        mkdirSync(globalModesRoot, { recursive: true });
        const legacyModeFile = path.join(globalModesRoot, 'agent-legacy-review.md');

        writeFileSync(
            legacyModeFile,
            `---
topLevelTab: agent
modeKey: legacy-review
label: Legacy Review
description: Legacy markdown-only review mode
---
# Legacy Review

- Review the repository with the legacy markdown prompt only.
`,
            'utf8'
        );

        await caller.registry.refresh({ profileId });
        const beforeExport = readFileSync(legacyModeFile, 'utf8');

        const exported = await caller.prompt.exportCustomMode({
            profileId,
            topLevelTab: 'agent',
            modeKey: 'legacy-review',
            scope: 'global',
        });

        expect(JSON.parse(exported.jsonText)).toEqual({
            slug: 'legacy-review',
            name: 'Legacy Review',
            description: 'Legacy markdown-only review mode',
            customInstructions: '# Legacy Review\n\n- Review the repository with the legacy markdown prompt only.',
        });
        expect(readFileSync(legacyModeFile, 'utf8')).toBe(beforeExport);
    });
});
