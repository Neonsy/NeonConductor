import { describe, expect, it } from 'vitest';

import { runStore } from '@/app/backend/persistence/stores';
import {
    createCaller,
    createSessionInScope,
    defaultRuntimeOptions,
    registerRuntimeContractHooks,
    requireEntityId,
    runtimeContractProfileId,
} from '@/app/backend/trpc/__tests__/runtime-contracts.shared';

registerRuntimeContractHooks();

describe('runtime contracts: memory', () => {
    const profileId = runtimeContractProfileId;

    it('creates, lists, disables, and supersedes memories through the API', async () => {
        const caller = createCaller();
        const workspaceFingerprint = 'wsf_runtime_memory';
        const created = await createSessionInScope(caller, profileId, {
            scope: 'workspace',
            workspaceFingerprint,
            title: 'Memory contract thread',
            kind: 'local',
            topLevelTab: 'agent',
        });
        const threadId = requireEntityId(created.thread.id, 'thr', 'Expected memory test thread id.');
        const run = await runStore.create({
            profileId,
            sessionId: created.session.id,
            prompt: 'Memory contract run',
            providerId: 'openai',
            modelId: 'openai/gpt-5',
            authMethod: 'api_key',
            runtimeOptions: defaultRuntimeOptions,
            cache: {
                applied: false,
            },
            transport: {},
        });

        const globalCreated = await caller.memory.create({
            profileId,
            memoryType: 'semantic',
            scopeKind: 'global',
            createdByKind: 'user',
            title: 'Global preference',
            bodyMarkdown: 'Use explicit names.',
            metadata: {
                source: 'manual',
            },
        });
        expect(globalCreated.memory.scopeKind).toBe('global');
        expect(globalCreated.memory.metadata).toEqual({ source: 'manual' });

        const workspaceCreated = await caller.memory.create({
            profileId,
            memoryType: 'episodic',
            scopeKind: 'workspace',
            createdByKind: 'system',
            workspaceFingerprint,
            title: 'Workspace lesson',
            bodyMarkdown: 'This workspace prefers deterministic steps.',
        });
        expect(workspaceCreated.memory.workspaceFingerprint).toBe(workspaceFingerprint);

        const threadCreated = await caller.memory.create({
            profileId,
            memoryType: 'procedural',
            scopeKind: 'thread',
            createdByKind: 'user',
            threadId,
            title: 'Thread note',
            bodyMarkdown: 'Follow up on the active task.',
        });
        expect(threadCreated.memory.threadId).toBe(threadId);
        expect(threadCreated.memory.workspaceFingerprint).toBe(workspaceFingerprint);

        const runCreated = await caller.memory.create({
            profileId,
            memoryType: 'episodic',
            scopeKind: 'run',
            createdByKind: 'system',
            runId: run.id,
            title: 'Run result',
            bodyMarkdown: 'The last run completed successfully.',
        });
        expect(runCreated.memory.runId).toBe(run.id);
        expect(runCreated.memory.threadId).toBe(threadId);
        expect(runCreated.memory.workspaceFingerprint).toBe(workspaceFingerprint);

        const listed = await caller.memory.list({ profileId });
        expect(listed.memories).toHaveLength(4);

        const filtered = await caller.memory.list({
            profileId,
            scopeKind: 'run',
            runId: run.id,
        });
        expect(filtered.memories.map((memory) => memory.id)).toEqual([runCreated.memory.id]);

        const disabled = await caller.memory.disable({
            profileId,
            memoryId: workspaceCreated.memory.id,
        });
        expect(disabled.memory.state).toBe('disabled');

        const superseded = await caller.memory.supersede({
            profileId,
            memoryId: threadCreated.memory.id,
            createdByKind: 'system',
            title: 'Thread note v2',
            bodyMarkdown: 'Updated thread note.',
            metadata: {
                revision: 2,
            },
        });
        expect(superseded.previous.state).toBe('superseded');
        expect(superseded.previous.supersededByMemoryId).toBe(superseded.replacement.id);
        expect(superseded.replacement.state).toBe('active');
        expect(superseded.replacement.threadId).toBe(threadId);
        expect(superseded.replacement.metadata).toEqual({ revision: 2 });
    });

    it('rejects invalid scope and provenance combinations', async () => {
        const caller = createCaller();
        const workspaceFingerprint = 'wsf_runtime_memory_validation';
        const created = await createSessionInScope(caller, profileId, {
            scope: 'workspace',
            workspaceFingerprint,
            title: 'Memory validation thread',
            kind: 'local',
            topLevelTab: 'agent',
        });
        const threadId = requireEntityId(created.thread.id, 'thr', 'Expected validation thread id.');
        const run = await runStore.create({
            profileId,
            sessionId: created.session.id,
            prompt: 'Memory validation run',
            providerId: 'openai',
            modelId: 'openai/gpt-5',
            authMethod: 'api_key',
            runtimeOptions: defaultRuntimeOptions,
            cache: {
                applied: false,
            },
            transport: {},
        });

        await expect(
            caller.memory.create({
                profileId,
                memoryType: 'semantic',
                scopeKind: 'global',
                createdByKind: 'user',
                workspaceFingerprint,
                title: 'Invalid global memory',
                bodyMarkdown: 'Should fail.',
            })
        ).rejects.toThrow(/does not allow workspace, thread, or run provenance/i);

        await expect(
            caller.memory.create({
                profileId,
                memoryType: 'procedural',
                scopeKind: 'thread',
                createdByKind: 'user',
                title: 'Missing thread',
                bodyMarkdown: 'Should fail.',
            })
        ).rejects.toThrow(/requires "threadId"/i);

        await expect(
            caller.memory.create({
                profileId,
                memoryType: 'episodic',
                scopeKind: 'run',
                createdByKind: 'system',
                runId: run.id,
                workspaceFingerprint: 'wsf_wrong_memory_workspace',
                title: 'Wrong run provenance',
                bodyMarkdown: 'Should fail.',
            })
        ).rejects.toThrow(/workspace provenance does not match/i);

        const activeMemory = await caller.memory.create({
            profileId,
            memoryType: 'semantic',
            scopeKind: 'thread',
            createdByKind: 'user',
            threadId,
            title: 'Lifecycle memory',
            bodyMarkdown: 'Active lifecycle memory.',
        });
        await caller.memory.disable({
            profileId,
            memoryId: activeMemory.memory.id,
        });

        await expect(
            caller.memory.disable({
                profileId,
                memoryId: activeMemory.memory.id,
            })
        ).rejects.toThrow(/Only active memory can be disabled/i);

        await expect(
            caller.memory.supersede({
                profileId,
                memoryId: activeMemory.memory.id,
                createdByKind: 'system',
                title: 'Disabled replacement',
                bodyMarkdown: 'Should fail.',
            })
        ).rejects.toThrow(/Only active memory can be superseded/i);
    });
});
