import { describe, expect, it } from 'vitest';

import { createCaller, registerRuntimeContractHooks, runtimeContractProfileId } from '@/app/backend/trpc/__tests__/runtime-contracts.shared';

registerRuntimeContractHooks();

describe('runtime contracts: flow', () => {
    const profileId = runtimeContractProfileId;

    it('creates, updates, lists, gets, and deletes canonical flow definitions', async () => {
        const caller = createCaller();

        const created = await caller.flow.createDefinition({
            profileId,
            label: 'Ship flow',
            description: 'Release flow',
            enabled: true,
            triggerKind: 'manual',
            steps: [
                {
                    kind: 'approval_gate',
                    id: 'step_gate',
                    label: 'Approve',
                },
            ],
        });
        expect(created.flowDefinition.originKind).toBe('canonical');

        const listed = await caller.flow.listDefinitions({ profileId });
        expect(listed.flowDefinitions.map((flowDefinition) => flowDefinition.definition.id)).toContain(
            created.flowDefinition.definition.id
        );

        const found = await caller.flow.getDefinition({
            profileId,
            flowDefinitionId: created.flowDefinition.definition.id,
        });
        expect(found.found).toBe(true);
        if (!found.found) {
            throw new Error('Expected canonical flow definition to be found.');
        }
        expect(found.flowDefinition.definition.label).toBe('Ship flow');

        const updated = await caller.flow.updateDefinition({
            profileId,
            flowDefinitionId: created.flowDefinition.definition.id,
            label: 'Ship flow updated',
            enabled: false,
            triggerKind: 'manual',
            steps: [
                {
                    kind: 'legacy_command',
                    id: 'step_run',
                    label: 'Run',
                    command: 'pnpm test',
                },
            ],
        });
        expect(updated.updated).toBe(true);
        if (!updated.updated) {
            throw new Error('Expected canonical flow definition to update.');
        }
        expect(updated.flowDefinition.definition.label).toBe('Ship flow updated');

        const deleted = await caller.flow.deleteDefinition({
            profileId,
            flowDefinitionId: created.flowDefinition.definition.id,
            confirm: true,
        });
        expect(deleted.deleted).toBe(true);
    });

    it('lists and reads persisted flow instances with lifecycle history', async () => {
        const caller = createCaller();
        const created = await caller.flow.createDefinition({
            profileId,
            label: 'Inspect flow',
            enabled: true,
            triggerKind: 'manual',
            steps: [
                {
                    kind: 'legacy_command',
                    id: 'step_run',
                    label: 'Run',
                    command: 'pnpm test',
                },
            ],
        });

        const directStore = await import('@/app/backend/persistence/stores/runtime/flowStore');
        const persistedInstance = await directStore.flowStore.createFlowInstance({
            profileId,
            flowDefinitionId: created.flowDefinition.definition.id,
            definitionSnapshot: created.flowDefinition.definition,
        });
        if (!persistedInstance) {
            throw new Error('Expected persisted flow instance.');
        }

        const runtimeStores = await import('@/app/backend/persistence/stores');
        await runtimeStores.runtimeEventStore.append({
            entityType: 'flow',
            domain: 'flow',
            operation: 'status',
            entityId: persistedInstance.instance.id,
            eventType: 'flow.completed',
            payload: {
                completedStepCount: 1,
                status: 'completed',
            },
        });
        await directStore.flowStore.updateFlowInstance({
            profileId,
            flowInstanceId: persistedInstance.instance.id,
            status: 'completed',
            currentStepIndex: 1,
            startedAt: '2026-04-02T10:00:00.000Z',
            finishedAt: '2026-04-02T10:01:00.000Z',
        });

        const listed = await caller.flow.listInstances({ profileId });
        expect(listed.flowInstances.map((flowInstance) => flowInstance.instance.id)).toContain(
            persistedInstance.instance.id
        );

        const found = await caller.flow.getInstance({
            profileId,
            flowInstanceId: persistedInstance.instance.id,
        });
        expect(found.found).toBe(true);
        if (!found.found) {
            throw new Error('Expected persisted flow instance to be found.');
        }
        expect(found.flowInstance.lifecycleEvents.at(-1)?.kind).toBe('flow.completed');
        expect(found.flowInstance.originKind).toBe('canonical');
    });
});
