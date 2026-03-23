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
                    INSERT OR REPLACE INTO app_prompt_layer_settings (id, global_instructions, updated_at)
                    VALUES (?, ?, ?)
                `
            )
            .run('global', '', now);

        const settings = await caller.prompt.getSettings({ profileId });
        expect(settings.settings.appGlobalInstructions).toBe('');
        expect(settings.settings.profileGlobalInstructions).toBe('');
        expect(settings.settings.topLevelInstructions.agent).toBe('');
    });
});
