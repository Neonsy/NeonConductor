import { beforeEach, describe, expect, it } from 'vitest';

import { resetPersistenceForTests } from '@/app/backend/persistence/db';
import {
    mcpStore,
    permissionStore,
    providerStore,
    sessionStore,
    toolStore,
} from '@/app/backend/persistence/stores';

describe('persistence stores', () => {
    beforeEach(() => {
        resetPersistenceForTests();
    });

    it('supports session store lifecycle CRUD-style flows', async () => {
        const session = await sessionStore.create('detached', 'local');
        expect(session.turnCount).toBe(0);

        const promptResult = await sessionStore.prompt(session.id, 'hello');
        expect(promptResult.accepted).toBe(true);

        const status = await sessionStore.status(session.id);
        expect(status.found).toBe(true);
        if (!status.found) {
            throw new Error('Expected session to exist.');
        }
        expect(status.session.runStatus).toBe('completed');

        const reverted = await sessionStore.revert(session.id);
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
        const providers = await providerStore.listProviders();
        const models = await providerStore.listModels('openai');
        expect(providers.length).toBeGreaterThan(0);
        expect(models.length).toBeGreaterThan(0);

        await providerStore.setDefaults('openai', 'openai/gpt-5');
        const defaults = await providerStore.getDefaults();
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
});

