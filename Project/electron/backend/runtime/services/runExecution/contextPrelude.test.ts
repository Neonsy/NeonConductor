import { beforeEach, describe, expect, it } from 'vitest';

import { getDefaultProfileId, getPersistence, resetPersistenceForTests } from '@/app/backend/persistence/db';
import {
    conversationStore,
    sessionAttachedRuleStore,
    sessionAttachedSkillStore,
    sessionStore,
    settingsStore,
    threadStore,
    workspaceRootStore,
} from '@/app/backend/persistence/stores';
import { buildSessionSystemPrelude } from '@/app/backend/runtime/services/runExecution/contextPrelude';
import { appPromptLayerSettingsStore } from '@/app/backend/persistence/stores/runtime/appPromptLayerSettingsStore';

describe('buildSessionSystemPrelude', () => {
    beforeEach(() => {
        resetPersistenceForTests();
    });

    it('includes the concrete workspace path for agent sessions', async () => {
        const profileId = getDefaultProfileId();
        const workspaceRoot = await workspaceRootStore.resolveOrCreate(profileId, 'M:\\Libraries\\Downloads\\test');
        const bucket = await conversationStore.createOrGetBucket({
            profileId,
            scope: 'workspace',
            workspaceFingerprint: workspaceRoot.fingerprint,
            title: 'Workspace Prelude',
        });
        if (bucket.isErr()) {
            throw new Error(bucket.error.message);
        }

        const thread = await threadStore.create({
            profileId,
            conversationId: bucket.value.id,
            title: 'Agent Thread',
            topLevelTab: 'agent',
        });
        if (thread.isErr()) {
            throw new Error(thread.error.message);
        }

        const session = await sessionStore.create(profileId, thread.value.id, 'local');
        if (!session.created) {
            throw new Error(`Expected session creation to succeed, received "${session.reason}".`);
        }

        const result = await buildSessionSystemPrelude({
            profileId,
            sessionId: session.session.id,
            prompt: 'Inspect the workspace setup.',
            topLevelTab: 'agent',
            workspaceFingerprint: workspaceRoot.fingerprint,
            resolvedMode: {
                mode: {
                    id: 'mode_profile_local_default_agent_code',
                    profileId,
                    topLevelTab: 'agent',
                    modeKey: 'code',
                    label: 'Agent Code',
                    prompt: {},
                    executionPolicy: {},
                    source: 'system',
                    enabled: true,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    assetKey: 'code',
                    sourceKind: 'system_seed',
                    scope: 'system',
                    tags: [],
                    precedence: 0,
                },
            },
        });

        expect(result.isOk()).toBe(true);
        if (result.isErr()) {
            throw new Error(result.error.message);
        }

        expect(result.value[0]?.role).toBe('system');
        const firstTextPart = result.value[0]?.parts[0];
        expect(firstTextPart?.type).toBe('text');
        if (!firstTextPart || firstTextPart.type !== 'text') {
            throw new Error('Expected workspace prelude text part.');
        }

        expect(firstTextPart.text).toContain('M:\\Libraries\\Downloads\\test');
        expect(firstTextPart.text).toContain('"/workspace"');
    });

    it('assembles prompt layers in the documented order for chat sessions', async () => {
        const profileId = getDefaultProfileId();
        const workspaceRoot = await workspaceRootStore.resolveOrCreate(profileId, 'M:\\Libraries\\Downloads\\prompt-order');
        const bucket = await conversationStore.createOrGetBucket({
            profileId,
            scope: 'workspace',
            workspaceFingerprint: workspaceRoot.fingerprint,
            title: 'Prompt Order',
        });
        if (bucket.isErr()) {
            throw new Error(bucket.error.message);
        }

        const thread = await threadStore.create({
            profileId,
            conversationId: bucket.value.id,
            title: 'Chat Thread',
            topLevelTab: 'chat',
        });
        if (thread.isErr()) {
            throw new Error(thread.error.message);
        }

        const session = await sessionStore.create(profileId, thread.value.id, 'local');
        if (!session.created) {
            throw new Error(`Expected session creation to succeed, received "${session.reason}".`);
        }

        await Promise.all([
            appPromptLayerSettingsStore.setGlobalInstructions('App layer'),
            settingsStore.setString(profileId, 'prompt_layer.profile_global_instructions', 'Profile layer'),
            settingsStore.setString(profileId, 'prompt_layer.top_level.chat', 'Chat layer'),
        ]);

        const { sqlite } = getPersistence();
        const now = new Date().toISOString();
        sqlite
            .prepare(
                `
                    INSERT INTO rulesets (
                        id, profile_id, asset_key, scope, workspace_fingerprint, name, body_markdown, source,
                        source_kind, activation_mode, enabled, precedence, created_at, updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `
            )
            .run(
                'ruleset_shared_rule',
                profileId,
                'shared_rule',
                'global',
                null,
                'Shared Rule',
                '# Shared Rule',
                'test',
                'system_seed',
                'manual',
                1,
                0,
                now,
                now
            );
        sqlite
            .prepare(
                `
                    INSERT INTO skillfiles (
                        id, profile_id, asset_key, scope, workspace_fingerprint, name, body_markdown, source,
                        source_kind, enabled, precedence, created_at, updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `
            )
            .run(
                'skillfile_attached_skill',
                profileId,
                'attached_skill',
                'global',
                null,
                'Attached Skill',
                '# Attached Skill',
                'test',
                'system_seed',
                1,
                0,
                now,
                now
            );

        const attachedRule = await sessionAttachedRuleStore.replaceForSession({
            profileId,
            sessionId: session.session.id,
            assetKeys: ['shared_rule'],
        });
        const attachedSkill = await sessionAttachedSkillStore.replaceForSession({
            profileId,
            sessionId: session.session.id,
            assetKeys: ['attached_skill'],
        });
        expect(attachedRule.length).toBe(1);
        expect(attachedSkill.length).toBe(1);

        const result = await buildSessionSystemPrelude({
            profileId,
            sessionId: session.session.id,
            prompt: 'Need prompt ordering',
            topLevelTab: 'chat',
            workspaceFingerprint: workspaceRoot.fingerprint,
            resolvedMode: {
                mode: {
                    id: 'mode_profile_local_default_chat_chat',
                    profileId,
                    topLevelTab: 'chat',
                    modeKey: 'chat',
                    label: 'Chat',
                    prompt: {
                        roleDefinition: 'Role layer',
                        customInstructions: 'Mode layer',
                    },
                    executionPolicy: {},
                    source: 'system',
                    enabled: true,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    assetKey: 'chat',
                    sourceKind: 'system_seed',
                    scope: 'system',
                    tags: [],
                    precedence: 0,
                },
            },
        });

        expect(result.isOk()).toBe(true);
        if (result.isErr()) {
            throw new Error(result.error.message);
        }

        const messageTexts = result.value.flatMap((message) =>
            message.parts.flatMap((part) => (part.type === 'text' ? [part.text] : []))
        );
        expect(messageTexts.map((message) => message.split('\n\n')[0])).toEqual([
            'Execution environment',
            'App instructions',
            'Profile instructions',
            'Built-in chat instructions',
            'Active mode role: Chat',
            'Active mode instructions: Chat',
            'Ruleset: Shared Rule',
            'Attached skill: Attached Skill',
        ]);
    });
});
