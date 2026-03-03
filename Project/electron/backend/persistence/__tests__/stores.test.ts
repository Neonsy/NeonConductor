import { beforeEach, describe, expect, it } from 'vitest';

import { getDefaultProfileId, resetPersistenceForTests } from '@/app/backend/persistence/db';
import {
    accountSnapshotStore,
    conversationStore,
    diffStore,
    marketplaceStore,
    mcpStore,
    modeStore,
    permissionStore,
    providerStore,
    runStore,
    secretReferenceStore,
    sessionStore,
    skillfileStore,
    tagStore,
    threadStore,
    toolStore,
} from '@/app/backend/persistence/stores';

describe('persistence stores', () => {
    beforeEach(() => {
        resetPersistenceForTests();
    });

    it('supports session store lifecycle CRUD-style flows', async () => {
        const profileId = getDefaultProfileId();
        const bucket = await conversationStore.createOrGetBucket({
            profileId,
            scope: 'detached',
            title: 'Detached',
        });
        const thread = await threadStore.create({
            profileId,
            conversationId: bucket.id,
            title: 'Main',
        });
        const session = await sessionStore.create(profileId, thread.id, 'local');
        expect(session.turnCount).toBe(0);

        const run = await runStore.create({
            profileId,
            sessionId: session.id,
            prompt: 'hello',
            providerId: 'openai',
            modelId: 'openai/gpt-5',
            authMethod: 'api_key',
            runtimeOptions: {
                reasoning: {
                    effort: 'none',
                    summary: 'none',
                    includeEncrypted: false,
                },
                cache: {
                    strategy: 'auto',
                },
                transport: {
                    openai: 'auto',
                },
            },
            cache: {
                applied: false,
                key: 'store-test',
                reason: 'unsupported_transport',
            },
            transport: {
                selected: 'responses',
            },
        });
        await sessionStore.markRunPending(profileId, session.id, run.id);
        await runStore.finalize(run.id, { status: 'completed' });
        await sessionStore.markRunTerminal(profileId, session.id, 'completed');

        const status = await sessionStore.status(profileId, session.id);
        expect(status.found).toBe(true);
        if (!status.found) {
            throw new Error('Expected session to exist.');
        }
        expect(status.session.runStatus).toBe('completed');

        const reverted = await sessionStore.revert(profileId, session.id);
        expect(reverted.reverted).toBe(true);
    });

    it('supports permission store decision transitions', async () => {
        const created = await permissionStore.create({
            policy: 'ask',
            resource: 'tool:run_command',
        });
        expect(created.decision).toBe('pending');

        const granted = await permissionStore.setDecision(created.id, 'granted');
        expect(granted?.decision).toBe('granted');

        const denied = await permissionStore.setDecision(created.id, 'denied');
        expect(denied?.decision).toBe('denied');
    });

    it('supports provider defaults and seeded catalogs', async () => {
        const profileId = getDefaultProfileId();
        const providers = await providerStore.listProviders();
        const models = await providerStore.listModels(profileId, 'openai');
        expect(providers.length).toBeGreaterThan(0);
        expect(models.length).toBeGreaterThan(0);
        const firstModel = models.at(0);
        expect(firstModel).toBeDefined();
        if (!firstModel) {
            throw new Error('Expected at least one model in provider catalog.');
        }
        expect(firstModel.supportsTools).toBeTypeOf('boolean');
        expect(firstModel.supportsReasoning).toBeTypeOf('boolean');
        expect(firstModel.inputModalities.includes('text')).toBe(true);
        expect(firstModel.outputModalities.includes('text')).toBe(true);

        await providerStore.setDefaults(profileId, 'openai', 'openai/gpt-5');
        const defaults = await providerStore.getDefaults(profileId);
        expect(defaults.providerId).toBe('openai');
    });

    it('supports mcp and tool seed stores', async () => {
        const tools = await toolStore.list();
        expect(tools.some((tool) => tool.id === 'read_file')).toBe(true);

        const servers = await mcpStore.listServers();
        expect(servers.some((server) => server.id === 'github')).toBe(true);

        const connected = await mcpStore.connect('github');
        expect(connected?.connectionState).toBe('connected');
    });

    it('seeds parity baseline stores', async () => {
        const profileId = getDefaultProfileId();

        const [modes, skillfiles, account, marketplacePackages, secretReferences] = await Promise.all([
            modeStore.listByProfile(profileId),
            skillfileStore.listByProfile(profileId),
            accountSnapshotStore.getByProfile(profileId),
            marketplaceStore.listPackages(),
            secretReferenceStore.listByProfile(profileId),
        ]);

        expect(modes.some((mode) => mode.topLevelTab === 'chat' && mode.modeKey === 'chat')).toBe(true);
        expect(modes.some((mode) => mode.topLevelTab === 'agent' && mode.modeKey === 'ask')).toBe(true);
        expect(skillfiles).toEqual([]);
        expect(account.authState).toBe('logged_out');
        expect(account.profileId).toBe(profileId);
        expect(marketplacePackages).toEqual([]);
        expect(secretReferences).toEqual([]);
    });

    it('supports conversations, threads, tags, and diffs', async () => {
        const profileId = getDefaultProfileId();
        const conversation = await conversationStore.createOrGetBucket({
            profileId,
            scope: 'workspace',
            workspaceFingerprint: 'wsf_workspace_a',
            title: 'Workspace Chat',
        });
        const thread = await threadStore.create({
            profileId,
            conversationId: conversation.id,
            title: 'Thread A',
        });
        const tag = await tagStore.upsert(profileId, 'backend');
        const linked = await tagStore.setThreadTags(profileId, thread.id, [tag.id]);

        const session = await sessionStore.create(profileId, thread.id, 'local');
        const run = await runStore.create({
            profileId,
            sessionId: session.id,
            prompt: 'first',
            providerId: 'openai',
            modelId: 'openai/gpt-5',
            authMethod: 'api_key',
            runtimeOptions: {
                reasoning: {
                    effort: 'none',
                    summary: 'none',
                    includeEncrypted: false,
                },
                cache: {
                    strategy: 'auto',
                },
                transport: {
                    openai: 'auto',
                },
            },
            cache: {
                applied: false,
                key: 'store-test',
                reason: 'unsupported_transport',
            },
            transport: {
                selected: 'responses',
            },
        });
        await sessionStore.markRunPending(profileId, session.id, run.id);
        await runStore.finalize(run.id, { status: 'completed' });
        await sessionStore.markRunTerminal(profileId, session.id, 'completed');

        const diff = await diffStore.create({
            profileId,
            sessionId: session.id,
            runId: run.id,
            summary: 'created patch',
            payload: { files: ['README.md'] },
        });

        const conversations = await conversationStore.listBuckets(profileId);
        const threads = await threadStore.list({
            profileId,
            scope: 'workspace',
            workspaceFingerprint: 'wsf_workspace_a',
            sort: 'latest',
        });
        const tags = await tagStore.listByProfile(profileId);
        const threadTags = await tagStore.listThreadTagsByProfile(profileId);
        const diffs = await diffStore.listBySession(profileId, session.id);
        const firstLinked = linked[0];
        if (!firstLinked) {
            throw new Error('Expected at least one linked thread tag.');
        }

        expect(conversations.some((item) => item.id === conversation.id)).toBe(true);
        expect(threads.some((item) => item.id === thread.id)).toBe(true);
        expect(tags.some((item) => item.id === tag.id)).toBe(true);
        expect(
            threadTags.some((item) => item.threadId === firstLinked.threadId && item.tagId === firstLinked.tagId)
        ).toBe(true);
        expect(diffs.some((item) => item.id === diff.id)).toBe(true);
    });
});
