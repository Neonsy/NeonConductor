import { describe, expect, it } from 'vitest';

import { memoryEvidenceStore, memoryRevisionStore, runStore } from '@/app/backend/persistence/stores';
import { memoryService } from '@/app/backend/runtime/services/memory/service';
import {
    createCaller,
    createSessionInScope,
    defaultRuntimeOptions,
    registerRuntimeContractHooks,
    runtimeContractProfileId,
} from '@/app/backend/trpc/__tests__/runtime-contracts.shared';

registerRuntimeContractHooks();

describe('memoryService evidence-backed writes', () => {
    const profileId = runtimeContractProfileId;

    it('persists supplied evidence on create and preserves it on in-place update', async () => {
        const caller = createCaller();
        const created = await createSessionInScope(caller, profileId, {
            scope: 'detached',
            title: 'Memory service evidence thread',
            kind: 'local',
            topLevelTab: 'chat',
        });
        const run = await runStore.create({
            profileId,
            sessionId: created.session.id,
            prompt: 'Memory service evidence run',
            providerId: 'openai',
            modelId: 'openai/gpt-5',
            authMethod: 'api_key',
            runtimeOptions: defaultRuntimeOptions,
            cache: {
                applied: false,
            },
            transport: {},
        });

        const createdMemory = await memoryService.createMemory({
            profileId,
            memoryType: 'semantic',
            scopeKind: 'global',
            createdByKind: 'user',
            title: 'Evidence-backed memory',
            bodyMarkdown: 'Original body.',
            evidence: [
                {
                    kind: 'run',
                    label: 'Service evidence run',
                    sourceRunId: run.id,
                },
            ],
        });
        expect(createdMemory.isOk()).toBe(true);
        if (createdMemory.isErr()) {
            throw new Error(createdMemory.error.message);
        }

        const evidenceBeforeUpdate = await memoryEvidenceStore.listByMemoryId(profileId, createdMemory.value.id);
        expect(evidenceBeforeUpdate.map((evidence) => evidence.label)).toEqual(['Service evidence run']);

        const updated = await memoryService.updateMemory({
            profileId,
            memoryId: createdMemory.value.id,
            title: 'Evidence-backed memory updated',
            bodyMarkdown: 'Updated body.',
        });
        expect(updated.isOk()).toBe(true);

        const evidenceAfterUpdate = await memoryEvidenceStore.listByMemoryId(profileId, createdMemory.value.id);
        expect(evidenceAfterUpdate.map((evidence) => evidence.label)).toEqual(['Service evidence run']);
    });

    it('does not inherit evidence on supersede unless replacement evidence is provided', async () => {
        const caller = createCaller();
        const created = await createSessionInScope(caller, profileId, {
            scope: 'detached',
            title: 'Memory service supersede thread',
            kind: 'local',
            topLevelTab: 'chat',
        });
        const run = await runStore.create({
            profileId,
            sessionId: created.session.id,
            prompt: 'Memory service supersede run',
            providerId: 'openai',
            modelId: 'openai/gpt-5',
            authMethod: 'api_key',
            runtimeOptions: defaultRuntimeOptions,
            cache: {
                applied: false,
            },
            transport: {},
        });

        const createdMemory = await memoryService.createMemory({
            profileId,
            memoryType: 'semantic',
            scopeKind: 'global',
            createdByKind: 'user',
            title: 'Superseded evidence memory',
            bodyMarkdown: 'Original body.',
            evidence: [
                {
                    kind: 'run',
                    label: 'Original evidence run',
                    sourceRunId: run.id,
                },
            ],
        });
        expect(createdMemory.isOk()).toBe(true);
        if (createdMemory.isErr()) {
            throw new Error(createdMemory.error.message);
        }

        const firstSupersede = await memoryService.supersedeMemory({
            profileId,
            memoryId: createdMemory.value.id,
            createdByKind: 'system',
            title: 'Replacement without evidence',
            bodyMarkdown: 'Replacement body.',
            revisionReason: 'refinement',
        });
        expect(firstSupersede.isOk()).toBe(true);
        if (firstSupersede.isErr()) {
            throw new Error(firstSupersede.error.message);
        }

        expect(await memoryEvidenceStore.listByMemoryId(profileId, firstSupersede.value.previous.id)).toHaveLength(1);
        expect(await memoryEvidenceStore.listByMemoryId(profileId, firstSupersede.value.replacement.id)).toEqual([]);

        const secondSupersede = await memoryService.supersedeMemory({
            profileId,
            memoryId: firstSupersede.value.replacement.id,
            createdByKind: 'system',
            title: 'Replacement with evidence',
            bodyMarkdown: 'Replacement body v2.',
            revisionReason: 'refinement',
            evidence: [
                {
                    kind: 'run',
                    label: 'Replacement evidence run',
                    sourceRunId: run.id,
                },
            ],
        });
        expect(secondSupersede.isOk()).toBe(true);
        if (secondSupersede.isErr()) {
            throw new Error(secondSupersede.error.message);
        }

        const replacementEvidence = await memoryEvidenceStore.listByMemoryId(profileId, secondSupersede.value.replacement.id);
        expect(replacementEvidence.map((evidence) => evidence.label)).toEqual(['Replacement evidence run']);
        expect(secondSupersede.value.replacement.temporalSubjectKey).toBeUndefined();

        const revision = await memoryRevisionStore.getByPreviousMemoryId(profileId, secondSupersede.value.previous.id);
        expect(revision?.revisionReason).toBe('refinement');
        expect(revision?.replacementMemoryId).toBe(secondSupersede.value.replacement.id);
    });

    it('rejects runtime_refresh outside automatic run-outcome supersession', async () => {
        const createdMemory = await memoryService.createMemory({
            profileId,
            memoryType: 'semantic',
            scopeKind: 'global',
            createdByKind: 'user',
            title: 'Manual semantic memory',
            bodyMarkdown: 'Manual semantic body.',
        });
        expect(createdMemory.isOk()).toBe(true);
        if (createdMemory.isErr()) {
            throw new Error(createdMemory.error.message);
        }

        const invalidSupersede = await memoryService.supersedeMemory({
            profileId,
            memoryId: createdMemory.value.id,
            createdByKind: 'system',
            title: 'Invalid runtime refresh replacement',
            bodyMarkdown: 'Should be rejected.',
            revisionReason: 'runtime_refresh',
        });

        expect(invalidSupersede.isErr()).toBe(true);
        if (invalidSupersede.isOk()) {
            throw new Error('Expected invalid runtime refresh supersede to fail.');
        }
        expect(invalidSupersede.error.message).toMatch(/Runtime refresh revisions/i);
    });

    it('inherits temporalSubjectKey through supersede revisions', async () => {
        const createdMemory = await memoryService.createMemory({
            profileId,
            memoryType: 'semantic',
            scopeKind: 'global',
            createdByKind: 'user',
            title: 'Subject-bound memory',
            bodyMarkdown: 'Original subject body.',
            temporalSubjectKey: 'subject::alpha',
        });
        expect(createdMemory.isOk()).toBe(true);
        if (createdMemory.isErr()) {
            throw new Error(createdMemory.error.message);
        }

        const superseded = await memoryService.supersedeMemory({
            profileId,
            memoryId: createdMemory.value.id,
            createdByKind: 'user',
            title: 'Subject-bound memory v2',
            bodyMarkdown: 'Replacement subject body.',
            revisionReason: 'correction',
        });
        expect(superseded.isOk()).toBe(true);
        if (superseded.isErr()) {
            throw new Error(superseded.error.message);
        }

        expect(superseded.value.replacement.temporalSubjectKey).toBe('subject::alpha');
    });
});
