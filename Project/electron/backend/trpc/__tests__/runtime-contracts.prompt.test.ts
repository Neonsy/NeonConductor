import { describe, expect, it } from 'vitest';

import { createCaller, getPersistence, registerRuntimeContractHooks, runtimeContractProfileId } from '@/app/backend/trpc/__tests__/runtime-contracts.shared';

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

        sqlite
            .prepare(
                `
                    INSERT INTO mode_definitions (
                        id, profile_id, top_level_tab, mode_key, label, asset_key, prompt_json,
                        execution_policy_json, source, source_kind, scope, workspace_fingerprint,
                        origin_path, description, tags_json, enabled, precedence, created_at, updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `
            )
            .run(
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

        await caller.prompt.setBuiltInModePrompt({
            profileId,
            topLevelTab: 'agent',
            modeKey: 'code',
            roleDefinition: 'Built-in role override',
            customInstructions: 'Built-in custom override',
        });

        const modes = await caller.mode.list({
            profileId,
            topLevelTab: 'agent',
        });
        expect(modes.modes.find((mode) => mode.modeKey === 'code')).toEqual(
            expect.objectContaining({
                label: 'Custom Agent Code',
                prompt: {
                    customInstructions: 'Workspace-owned custom code mode.',
                },
            })
        );
    });
});
