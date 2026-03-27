import { describe, expect, it } from 'vitest';

import { runStore } from '@/app/backend/persistence/stores';
import { resolveCanonicalMemoryProvenance } from '@/app/backend/runtime/services/memory/memoryProvenancePolicy';
import {
    createCaller,
    createSessionInScope,
    defaultRuntimeOptions,
    registerRuntimeContractHooks,
    requireEntityId,
    runtimeContractProfileId,
} from '@/app/backend/trpc/__tests__/runtime-contracts.shared';

registerRuntimeContractHooks();

describe('resolveCanonicalMemoryProvenance', () => {
    const profileId = runtimeContractProfileId;

    it('accepts global provenance only when no extra provenance is present', async () => {
        const result = await resolveCanonicalMemoryProvenance({
            profileId,
            scopeKind: 'global',
        });

        expect(result.isOk()).toBe(true);
        if (result.isErr()) {
            throw new Error(result.error.message);
        }
        expect(result.value).toEqual({});
    });

    it('rejects extra provenance for global scope', async () => {
        const result = await resolveCanonicalMemoryProvenance({
            profileId,
            scopeKind: 'global',
            workspaceFingerprint: 'wsf_global_should_not_be_here',
        });

        expect(result.isErr()).toBe(true);
        if (result.isOk()) {
            throw new Error('Expected global provenance validation to fail.');
        }
        expect(result.error.code).toBe('invalid_input');
    });

    it('resolves workspace provenance from an explicit fingerprint', async () => {
        const result = await resolveCanonicalMemoryProvenance({
            profileId,
            scopeKind: 'workspace',
            workspaceFingerprint: 'wsf_memory_workspace',
        });

        expect(result.isOk()).toBe(true);
        if (result.isErr()) {
            throw new Error(result.error.message);
        }
        expect(result.value).toEqual({
            workspaceFingerprint: 'wsf_memory_workspace',
        });
    });

    it('resolves thread provenance from the stored thread and workspace bucket', async () => {
        const caller = createCaller();
        const created = await createSessionInScope(caller, profileId, {
            scope: 'workspace',
            workspaceFingerprint: 'wsf_memory_thread_provenance',
            title: 'Thread provenance session',
            kind: 'local',
            topLevelTab: 'agent',
        });
        const threadId = requireEntityId(created.thread.id, 'thr', 'Expected thread id.');

        const result = await resolveCanonicalMemoryProvenance({
            profileId,
            scopeKind: 'thread',
            threadId,
        });

        expect(result.isOk()).toBe(true);
        if (result.isErr()) {
            throw new Error(result.error.message);
        }
        expect(result.value).toEqual({
            workspaceFingerprint: 'wsf_memory_thread_provenance',
            threadId,
        });
    });

    it('resolves run provenance from the stored run and session thread', async () => {
        const caller = createCaller();
        const created = await createSessionInScope(caller, profileId, {
            scope: 'workspace',
            workspaceFingerprint: 'wsf_memory_run_provenance',
            title: 'Run provenance session',
            kind: 'local',
            topLevelTab: 'agent',
        });
        const run = await runStore.create({
            profileId,
            sessionId: created.session.id,
            prompt: 'Capture run provenance.',
            providerId: 'openai',
            modelId: 'openai/gpt-5',
            authMethod: 'api_key',
            runtimeOptions: defaultRuntimeOptions,
            cache: {
                applied: false,
            },
            transport: {},
        });
        const runId = requireEntityId(run.id, 'run', 'Expected run id.');
        const threadId = requireEntityId(created.thread.id, 'thr', 'Expected thread id.');

        const result = await resolveCanonicalMemoryProvenance({
            profileId,
            scopeKind: 'run',
            runId,
        });

        expect(result.isOk()).toBe(true);
        if (result.isErr()) {
            throw new Error(result.error.message);
        }
        expect(result.value).toEqual({
            workspaceFingerprint: 'wsf_memory_run_provenance',
            threadId,
            runId,
        });
    });

    it('rejects mismatched workspace provenance for run scope', async () => {
        const caller = createCaller();
        const created = await createSessionInScope(caller, profileId, {
            scope: 'workspace',
            workspaceFingerprint: 'wsf_memory_run_mismatch',
            title: 'Run mismatch session',
            kind: 'local',
            topLevelTab: 'agent',
        });
        const run = await runStore.create({
            profileId,
            sessionId: created.session.id,
            prompt: 'Capture run provenance.',
            providerId: 'openai',
            modelId: 'openai/gpt-5',
            authMethod: 'api_key',
            runtimeOptions: defaultRuntimeOptions,
            cache: {
                applied: false,
            },
            transport: {},
        });
        const runId = requireEntityId(run.id, 'run', 'Expected run id.');

        const result = await resolveCanonicalMemoryProvenance({
            profileId,
            scopeKind: 'run',
            runId,
            workspaceFingerprint: 'wsf_different_workspace',
        });

        expect(result.isErr()).toBe(true);
        if (result.isOk()) {
            throw new Error('Expected run provenance validation to fail.');
        }
        expect(result.error.code).toBe('invalid_input');
    });
});
