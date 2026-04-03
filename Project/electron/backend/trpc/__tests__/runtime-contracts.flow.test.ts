import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { buildShellApprovalContext } from '@/app/backend/runtime/services/toolExecution/shellApproval';
import { createCaller, registerRuntimeContractHooks, runtimeContractProfileId } from '@/app/backend/trpc/__tests__/runtime-contracts.shared';

registerRuntimeContractHooks();

async function seedWorkspaceRoot(profileId: string, workspaceFingerprint: string): Promise<string> {
    const workspacePath = mkdtempSync(join(tmpdir(), `${workspaceFingerprint}-`));
    const now = new Date().toISOString();

    const { getPersistence } = await import('@/app/backend/trpc/__tests__/runtime-contracts.shared');
    getPersistence()
        .sqlite.prepare(
            `
                INSERT OR IGNORE INTO workspace_roots
                    (fingerprint, profile_id, absolute_path, path_key, label, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `
        )
        .run(
            workspaceFingerprint,
            profileId,
            workspacePath,
            process.platform === 'win32' ? workspacePath.toLowerCase() : workspacePath,
            basename(workspacePath),
            now,
            now
        );

    return workspacePath;
}

async function waitForFlowInstanceStatus(input: {
    caller: ReturnType<typeof createCaller>;
    profileId: string;
    flowInstanceId: string;
    expectedStatus: 'approval_required' | 'running' | 'failed' | 'completed' | 'cancelled';
}) {
    for (let attempt = 0; attempt < 120; attempt += 1) {
        const found = await input.caller.flow.getInstance({
            profileId: input.profileId,
            flowInstanceId: input.flowInstanceId,
        });
        if (found.found && found.flowInstance.instance.status === input.expectedStatus) {
            return found.flowInstance;
        }

        await new Promise((resolve) => setTimeout(resolve, 25));
    }

    throw new Error(
        `Timed out waiting for flow instance "${input.flowInstanceId}" to reach status "${input.expectedStatus}".`
    );
}

async function waitForFlowInstanceByDefinition(input: {
    profileId: string;
    flowDefinitionId: string;
    expectedStatus: 'running' | 'approval_required';
}) {
    const { getPersistence } = await import('@/app/backend/trpc/__tests__/runtime-contracts.shared');

    for (let attempt = 0; attempt < 120; attempt += 1) {
        const flowInstance = await getPersistence().db
            .selectFrom('flow_instances')
            .selectAll()
            .where('profile_id', '=', input.profileId)
            .where('flow_definition_id', '=', input.flowDefinitionId)
            .orderBy('created_at', 'desc')
            .executeTakeFirst();
        if (flowInstance && flowInstance.status === input.expectedStatus) {
            return flowInstance;
        }

        await new Promise((resolve) => setTimeout(resolve, 25));
    }

    throw new Error(
        `Timed out waiting for a flow instance from "${input.flowDefinitionId}" to reach status "${input.expectedStatus}".`
    );
}

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

    it('starts approval-gated flows, resumes them, and projects execution-aware instance state', async () => {
        const caller = createCaller();
        const workspaceFingerprint = 'ws_flow_gate_resume';
        await seedWorkspaceRoot(profileId, workspaceFingerprint);
        const resumedCommand = 'node -e "process.exit(0)"';
        const resumedCommandResource = buildShellApprovalContext(resumedCommand).approvalCandidates[0]?.resource;
        if (!resumedCommandResource) {
            throw new Error('Expected shell approval prefix resource for approval-gated flow test.');
        }
        await caller.permission.setWorkspaceOverride({
            profileId,
            workspaceFingerprint,
            resource: resumedCommandResource,
            policy: 'allow',
        });

        const created = await caller.flow.createDefinition({
            profileId,
            label: 'Approval flow',
            enabled: true,
            triggerKind: 'manual',
            steps: [
                {
                    kind: 'approval_gate',
                    id: 'step_gate',
                    label: 'Approve',
                },
                {
                    kind: 'legacy_command',
                    id: 'step_run',
                    label: 'Run',
                    command: resumedCommand,
                },
            ],
        });

        const started = await caller.flow.startInstance({
            profileId,
            flowDefinitionId: created.flowDefinition.definition.id,
            executionContext: {
                workspaceFingerprint,
            },
        });
        expect(started.found).toBe(true);
        if (!started.found) {
            throw new Error('Expected approval-gated flow instance to start.');
        }
        expect(started.flowInstance.instance.status).toBe('approval_required');
        expect(started.flowInstance.currentStep).toEqual({
            stepIndex: 0,
            step: {
                kind: 'approval_gate',
                id: 'step_gate',
                label: 'Approve',
            },
        });
        expect(started.flowInstance.awaitingApproval).toMatchObject({
            kind: 'flow_gate',
            stepIndex: 0,
            stepId: 'step_gate',
        });
        expect(started.flowInstance.availableActions).toEqual({
            canResume: true,
            canCancel: true,
            canRetry: false,
        });

        const resumed = await caller.flow.resumeInstance({
            profileId,
            flowInstanceId: started.flowInstance.instance.id,
            expectedStepIndex: 0,
            expectedStepId: 'step_gate',
        });
        expect(resumed.found).toBe(true);
        if (!resumed.found) {
            throw new Error('Expected approval-gated flow instance to resume.');
        }
        expect(resumed.flowInstance.instance.status).toBe('completed');
        expect(resumed.flowInstance.awaitingApproval).toBeUndefined();
        expect(resumed.flowInstance.executionContext).toEqual({
            workspaceFingerprint,
        });
        expect(resumed.flowInstance.lifecycleEvents.map((event) => event.kind)).toEqual([
            'flow.started',
            'flow.step_started',
            'flow.approval_required',
            'flow.step_completed',
            'flow.step_started',
            'flow.step_completed',
            'flow.completed',
        ]);
    });

    it('auto-resumes permission-blocked legacy-command flows after approval and persists permission provenance', async () => {
        const caller = createCaller();
        const workspaceFingerprint = 'ws_flow_permission_resume';
        await seedWorkspaceRoot(profileId, workspaceFingerprint);
        const command = 'node -e "process.exit(0)"';
        const commandResource = buildShellApprovalContext(command).approvalCandidates[0]?.resource;
        if (!commandResource) {
            throw new Error('Expected shell approval prefix resource for permission-resume test.');
        }

        await caller.permission.setWorkspaceOverride({
            profileId,
            workspaceFingerprint,
            resource: commandResource,
            policy: 'ask',
        });

        const created = await caller.flow.createDefinition({
            profileId,
            label: 'Shell approval flow',
            enabled: true,
            triggerKind: 'manual',
            steps: [
                {
                    kind: 'legacy_command',
                    id: 'step_run',
                    label: 'Run',
                    command,
                },
            ],
        });

        const started = await caller.flow.startInstance({
            profileId,
            flowDefinitionId: created.flowDefinition.definition.id,
            executionContext: {
                workspaceFingerprint,
            },
        });
        expect(started.found).toBe(true);
        if (!started.found || !started.flowInstance.awaitingApproval?.permissionRequestId) {
            throw new Error('Expected permission-blocked flow instance.');
        }
        expect(started.flowInstance.instance.status).toBe('approval_required');
        expect(started.flowInstance.awaitingApproval).toMatchObject({
            kind: 'tool_permission',
            stepIndex: 0,
            stepId: 'step_run',
        });
        expect(started.flowInstance.availableActions).toEqual({
            canResume: false,
            canCancel: true,
            canRetry: false,
        });

        const permissionRequestId = started.flowInstance.awaitingApproval.permissionRequestId;
        const { getPersistence } = await import('@/app/backend/trpc/__tests__/runtime-contracts.shared');
        const permissionRow = await getPersistence().db
            .selectFrom('permissions')
            .selectAll()
            .where('id', '=', permissionRequestId)
            .executeTakeFirstOrThrow();
        expect(permissionRow.flow_instance_id).toBe(started.flowInstance.instance.id);
        expect(permissionRow.flow_step_index).toBe(0);
        expect(permissionRow.flow_step_id).toBe('step_run');

        const resolved = await caller.permission.resolve({
            profileId,
            requestId: permissionRequestId,
            resolution: 'allow_once',
        });
        expect(resolved.updated).toBe(true);

        const completed = await waitForFlowInstanceStatus({
            caller,
            profileId,
            flowInstanceId: started.flowInstance.instance.id,
            expectedStatus: 'completed',
        });
        expect(completed.awaitingApproval).toBeUndefined();
        expect(completed.instance.status).toBe('completed');
        expect(completed.lifecycleEvents.map((event) => event.kind)).toEqual([
            'flow.started',
            'flow.step_started',
            'flow.approval_required',
            'flow.step_completed',
            'flow.completed',
        ]);
    });

    it('marks permission-blocked flows failed when shell approval is denied', async () => {
        const caller = createCaller();
        const workspaceFingerprint = 'ws_flow_permission_deny';
        await seedWorkspaceRoot(profileId, workspaceFingerprint);
        const command = 'node -e "process.exit(0)"';
        const commandResource = buildShellApprovalContext(command).approvalCandidates[0]?.resource;
        if (!commandResource) {
            throw new Error('Expected shell approval prefix resource for permission-denial test.');
        }

        await caller.permission.setWorkspaceOverride({
            profileId,
            workspaceFingerprint,
            resource: commandResource,
            policy: 'ask',
        });

        const created = await caller.flow.createDefinition({
            profileId,
            label: 'Denied approval flow',
            enabled: true,
            triggerKind: 'manual',
            steps: [
                {
                    kind: 'legacy_command',
                    id: 'step_run',
                    label: 'Run',
                    command,
                },
            ],
        });

        const started = await caller.flow.startInstance({
            profileId,
            flowDefinitionId: created.flowDefinition.definition.id,
            executionContext: {
                workspaceFingerprint,
            },
        });
        expect(started.found).toBe(true);
        if (!started.found || !started.flowInstance.awaitingApproval?.permissionRequestId) {
            throw new Error('Expected permission-blocked flow instance for denial test.');
        }

        const denied = await caller.permission.resolve({
            profileId,
            requestId: started.flowInstance.awaitingApproval.permissionRequestId,
            resolution: 'deny',
        });
        expect(denied.updated).toBe(true);

        const failed = await waitForFlowInstanceStatus({
            caller,
            profileId,
            flowInstanceId: started.flowInstance.instance.id,
            expectedStatus: 'failed',
        });
        expect(failed.lastErrorMessage).toContain('approval was denied');
        expect(failed.availableActions.canRetry).toBe(true);
    });

    it('fails denied and unsupported flows, retries failed instances from immutable snapshots, and cancels running commands', async () => {
        const caller = createCaller();

        const denyWorkspaceFingerprint = 'ws_flow_retry_deny';
        await seedWorkspaceRoot(profileId, denyWorkspaceFingerprint);
        const deniedCommand = 'node -e "process.exit(0)"';
        const deniedCommandResource = buildShellApprovalContext(deniedCommand).approvalCandidates[0]?.resource;
        if (!deniedCommandResource) {
            throw new Error('Expected shell approval prefix resource for denied-flow test.');
        }
        await caller.permission.setWorkspaceOverride({
            profileId,
            workspaceFingerprint: denyWorkspaceFingerprint,
            resource: deniedCommandResource,
            policy: 'deny',
        });

        const deniedDefinition = await caller.flow.createDefinition({
            profileId,
            label: 'Denied flow',
            enabled: true,
            triggerKind: 'manual',
            steps: [
                {
                    kind: 'legacy_command',
                    id: 'step_run',
                    label: 'Run',
                    command: deniedCommand,
                },
            ],
        });

        const deniedStart = await caller.flow.startInstance({
            profileId,
            flowDefinitionId: deniedDefinition.flowDefinition.definition.id,
            executionContext: {
                workspaceFingerprint: denyWorkspaceFingerprint,
            },
        });
        expect(deniedStart.found).toBe(true);
        if (!deniedStart.found) {
            throw new Error('Expected denied flow instance to start.');
        }
        expect(deniedStart.flowInstance.instance.status).toBe('failed');
        expect(deniedStart.flowInstance.lastErrorMessage).toContain('denied by the current shell safety policy');
        expect(deniedStart.flowInstance.availableActions.canRetry).toBe(true);

        await caller.permission.setWorkspaceOverride({
            profileId,
            workspaceFingerprint: denyWorkspaceFingerprint,
            resource: deniedCommandResource,
            policy: 'allow',
        });

        const retried = await caller.flow.retryInstance({
            profileId,
            flowInstanceId: deniedStart.flowInstance.instance.id,
        });
        expect(retried.found).toBe(true);
        if (!retried.found) {
            throw new Error('Expected failed flow instance to retry.');
        }
        expect(retried.flowInstance.instance.status).toBe('completed');
        expect(retried.flowInstance.retrySourceFlowInstanceId).toBe(deniedStart.flowInstance.instance.id);

        const unsupportedDefinition = await caller.flow.createDefinition({
            profileId,
            label: 'Unsupported flow',
            enabled: true,
            triggerKind: 'manual',
            steps: [
                {
                    kind: 'mode_run',
                    id: 'step_mode',
                    label: 'Run mode',
                    topLevelTab: 'agent',
                    modeKey: 'code',
                },
            ],
        });
        const unsupportedStart = await caller.flow.startInstance({
            profileId,
            flowDefinitionId: unsupportedDefinition.flowDefinition.definition.id,
        });
        expect(unsupportedStart.found).toBe(true);
        if (!unsupportedStart.found) {
            throw new Error('Expected unsupported flow instance to start.');
        }
        expect(unsupportedStart.flowInstance.instance.status).toBe('failed');
        expect(unsupportedStart.flowInstance.lastErrorMessage).toContain(
            'not executable in Execute Flow Slice 3'
        );

        const cancelWorkspaceFingerprint = 'ws_flow_cancel';
        await seedWorkspaceRoot(profileId, cancelWorkspaceFingerprint);
        const cancelCommand = 'node -e "setTimeout(() => process.exit(0), 10000)"';
        const cancelCommandResource = buildShellApprovalContext(cancelCommand).approvalCandidates[0]?.resource;
        if (!cancelCommandResource) {
            throw new Error('Expected shell approval prefix resource for cancellable-flow test.');
        }
        await caller.permission.setWorkspaceOverride({
            profileId,
            workspaceFingerprint: cancelWorkspaceFingerprint,
            resource: cancelCommandResource,
            policy: 'allow',
        });

        const cancellableDefinition = await caller.flow.createDefinition({
            profileId,
            label: 'Cancelable flow',
            enabled: true,
            triggerKind: 'manual',
            steps: [
                {
                    kind: 'legacy_command',
                    id: 'step_run',
                    label: 'Run long command',
                    command: cancelCommand,
                },
            ],
        });

        const startPromise = caller.flow.startInstance({
            profileId,
            flowDefinitionId: cancellableDefinition.flowDefinition.definition.id,
            executionContext: {
                workspaceFingerprint: cancelWorkspaceFingerprint,
            },
        });
        const runningInstance = await waitForFlowInstanceByDefinition({
            profileId,
            flowDefinitionId: cancellableDefinition.flowDefinition.definition.id,
            expectedStatus: 'running',
        });

        const cancelled = await caller.flow.cancelInstance({
            profileId,
            flowInstanceId: runningInstance.id,
        });
        expect(cancelled.found).toBe(true);
        if (!cancelled.found) {
            throw new Error('Expected running flow instance to cancel.');
        }
        expect(cancelled.flowInstance.instance.status).toBe('cancelled');
        expect(cancelled.flowInstance.availableActions.canRetry).toBe(true);

        const startedResult = await startPromise;
        expect(startedResult.found).toBe(true);
        if (!startedResult.found) {
            throw new Error('Expected cancellable flow start to return a flow instance.');
        }
        expect(startedResult.flowInstance.instance.status).toBe('cancelled');
    });
});
