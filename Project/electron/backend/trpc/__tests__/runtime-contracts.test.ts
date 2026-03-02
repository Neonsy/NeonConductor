import { beforeEach, describe, expect, it } from 'vitest';

import { resetRuntimeState } from '@/app/backend/runtime/state';
import { appRouter } from '@/app/backend/trpc/router';

import type { Context } from '@/app/backend/trpc/context';

function createCaller() {
    const context: Context = {
        senderId: 1,
        win: null,
    };

    return appRouter.createCaller(context);
}

beforeEach(() => {
    resetRuntimeState();
});

describe('runtime contracts', () => {
    it('exposes all new runtime domains in root router', async () => {
        const caller = createCaller();

        const sessions = await caller.session.list();
        const providers = await caller.provider.listProviders();
        const pendingPermissions = await caller.permission.listPending();
        const tools = await caller.tool.list();
        const mcpServers = await caller.mcp.listServers();

        expect(sessions.sessions).toEqual([]);
        expect(providers.providers.length).toBeGreaterThan(0);
        expect(pendingPermissions.requests).toEqual([]);
        expect(tools.tools.length).toBeGreaterThan(0);
        expect(mcpServers.servers.length).toBeGreaterThan(0);
    });

    it('supports session lifecycle including completion, abort, and revert', async () => {
        const caller = createCaller();

        const created = await caller.session.create({
            scope: 'detached',
            kind: 'local',
        });
        const sessionId = created.session.id;

        const initialStatus = await caller.session.status({ sessionId });
        expect(initialStatus.found).toBe(true);
        if (!initialStatus.found) {
            throw new Error('Expected session to exist.');
        }
        expect(initialStatus.session.runStatus).toBe('idle');

        const firstPrompt = await caller.session.prompt({
            sessionId,
            prompt: 'First prompt',
        });
        expect(firstPrompt.accepted).toBe(true);

        const completedStatus = await caller.session.status({ sessionId });
        expect(completedStatus.found).toBe(true);
        if (!completedStatus.found) {
            throw new Error('Expected session to exist after prompt.');
        }
        expect(completedStatus.session.runStatus).toBe('completed');
        expect(completedStatus.session.turnCount).toBe(1);

        const secondPrompt = await caller.session.prompt({
            sessionId,
            prompt: 'Second prompt',
        });
        expect(secondPrompt.accepted).toBe(true);

        const aborted = await caller.session.abort({ sessionId });
        expect(aborted.aborted).toBe(true);

        const afterAbort = await caller.session.status({ sessionId });
        expect(afterAbort.found).toBe(true);
        if (!afterAbort.found) {
            throw new Error('Expected session to exist after abort.');
        }
        expect(afterAbort.session.runStatus).toBe('aborted');
        expect(afterAbort.session.turnCount).toBe(2);

        const reverted = await caller.session.revert({ sessionId });
        expect(reverted.reverted).toBe(true);
        if (!reverted.reverted) {
            throw new Error('Expected revert to succeed.');
        }
        expect(reverted.session.turnCount).toBe(1);
        expect(reverted.session.runStatus).toBe('completed');
    });

    it('handles permission request, grant, deny, and idempotency', async () => {
        const caller = createCaller();

        const requested = await caller.permission.request({
            policy: 'ask',
            resource: 'tool:run_command',
            rationale: 'Need shell command access',
        });
        const requestId = requested.request.id;

        const pending = await caller.permission.listPending();
        expect(pending.requests.some((item) => item.id === requestId)).toBe(true);

        const granted = await caller.permission.grant({ requestId });
        expect(granted.updated).toBe(true);

        const grantedAgain = await caller.permission.grant({ requestId });
        expect(grantedAgain.updated).toBe(false);
        expect(grantedAgain.reason).toBe('already_granted');

        const deniedAfterGrant = await caller.permission.deny({ requestId });
        expect(deniedAfterGrant.updated).toBe(true);

        const deniedAgain = await caller.permission.deny({ requestId });
        expect(deniedAgain.updated).toBe(false);
        expect(deniedAgain.reason).toBe('already_denied');
    });

    it('persists provider default in memory and lists models', async () => {
        const caller = createCaller();

        const providersBefore = await caller.provider.listProviders();
        const models = await caller.provider.listModels({ providerId: 'openai' });
        expect(models.models.length).toBeGreaterThan(0);

        const changed = await caller.provider.setDefault({
            providerId: 'openai',
            modelId: 'openai/gpt-5',
        });
        expect(changed.success).toBe(true);

        const providersAfter = await caller.provider.listProviders();
        const defaultProvider = providersAfter.providers.find((item) => item.isDefault);

        expect(defaultProvider?.id).toBe('openai');
        expect(providersBefore.providers.some((item) => item.id === 'kilo')).toBe(true);
    });

    it('returns deterministic tool and mcp behavior for stub calls', async () => {
        const caller = createCaller();

        const tools = await caller.tool.list();
        expect(tools.tools.map((item) => item.id)).toContain('read_file');

        const toolInvocation = await caller.tool.invoke({
            toolId: 'read_file',
            args: {
                path: '/tmp/file.txt',
            },
        });
        expect(toolInvocation.ok).toBe(true);

        const mcpServers = await caller.mcp.listServers();
        expect(mcpServers.servers.map((item) => item.id)).toContain('github');

        const connected = await caller.mcp.connect({ serverId: 'github' });
        expect(connected.connected).toBe(true);

        const authStatus = await caller.mcp.authStatus({ serverId: 'github' });
        expect(authStatus.found).toBe(true);
        if (!authStatus.found) {
            throw new Error('Expected MCP auth status result.');
        }
        expect(authStatus.connectionState).toBe('connected');

        const disconnected = await caller.mcp.disconnect({ serverId: 'github' });
        expect(disconnected.disconnected).toBe(true);
    });
});

