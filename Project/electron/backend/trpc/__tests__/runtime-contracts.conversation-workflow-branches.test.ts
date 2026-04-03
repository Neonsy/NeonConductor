import { describe, expect, it, vi } from 'vitest';

import { threadStore } from '@/app/backend/persistence/stores';
import { buildShellApprovalContext } from '@/app/backend/runtime/services/toolExecution/shellApproval';
import {
    getPersistence,
    runtimeContractProfileId,
    registerRuntimeContractHooks,
    createCaller,
    createSessionInScope,
    defaultRuntimeOptions,
    waitForRunStatus,
} from '@/app/backend/trpc/__tests__/runtime-contracts.shared';

registerRuntimeContractHooks();

async function waitForFlowInstanceStatus(
    flowInstanceId: string,
    expectedStatus: 'approval_required' | 'failed' | 'completed' | 'cancelled' | 'running'
): Promise<void> {
    for (let attempt = 0; attempt < 80; attempt += 1) {
        const flowInstance = await getPersistence().db
            .selectFrom('flow_instances')
            .selectAll()
            .where('id', '=', flowInstanceId)
            .executeTakeFirst();
        if (flowInstance && flowInstance.status === expectedStatus) {
            return;
        }

        await new Promise((resolve) => setTimeout(resolve, 25));
    }

    throw new Error(`Timed out waiting for flow instance "${flowInstanceId}" to reach status "${expectedStatus}".`);
}

describe('runtime contracts: conversation and runs', () => {
    const profileId = runtimeContractProfileId;
    it('creates an isolated fresh sandbox target for workflow-capable branches even with no workflow selected', async () => {
        const caller = createCaller();
        vi.stubGlobal(
            'fetch',
            vi.fn(() =>
                Promise.resolve({
                    ok: true,
                    status: 200,
                    statusText: 'OK',
                    json: () => ({
                        choices: [
                            {
                                message: {
                                    content: 'assistant response',
                                },
                            },
                        ],
                        usage: {
                            prompt_tokens: 8,
                            completion_tokens: 12,
                            total_tokens: 20,
                        },
                    }),
                })
            )
        );
        const configured = await caller.provider.setApiKey({
            profileId,
            providerId: 'openai',
            apiKey: 'openai-branch-workflow-key',
        });
        expect(configured.success).toBe(true);

        const created = await createSessionInScope(caller, profileId, {
            scope: 'workspace',
            workspaceFingerprint: 'ws_branch_workflow_noop',
            title: 'Workflow Branch Agent Thread',
            kind: 'local',
            topLevelTab: 'agent',
        });
        const workspaceFingerprint = 'ws_branch_workflow_noop';

        const started = await caller.session.startRun({
            profileId,
            sessionId: created.session.id,
            prompt: 'Create branchable history',
            topLevelTab: 'agent',
            modeKey: 'code',
            workspaceFingerprint,
            runtimeOptions: defaultRuntimeOptions,
            providerId: 'openai',
            modelId: 'openai/gpt-5',
        });
        expect(started.accepted).toBe(true);
        if (!started.accepted) {
            throw new Error('Expected source run to start.');
        }
        await waitForRunStatus(caller, profileId, created.session.id, 'completed');

        const sourceThreadRecord = await threadStore.getBySessionId(profileId, created.session.id);
        expect(sourceThreadRecord?.thread.sandboxId).toBeDefined();
        const sourceMessages = await caller.session.listMessages({
            profileId,
            sessionId: created.session.id,
        });
        const branchMessage = sourceMessages.messages.filter((message) => message.role === 'assistant').at(-1);
        if (!branchMessage) {
            throw new Error('Expected assistant message for branch target.');
        }

        const branched = await caller.session.branchFromMessageWithBranchWorkflow({
            profileId,
            sessionId: created.session.id,
            topLevelTab: 'agent',
            modeKey: 'code',
            messageId: branchMessage.id,
        });
        expect(branched.branched).toBe(true);
        if (!branched.branched) {
            throw new Error(`Expected workflow branch to succeed, received "${branched.reason}".`);
        }
        expect(branched.branchWorkflowExecution.status).toBe('not_requested');
        expect(branched.branchWorkflowExecution.flowDefinitionId).toBeUndefined();
        expect(branched.branchWorkflowExecution.flowInstanceId).toBeUndefined();
        expect(branched.thread.sandboxId).toBeDefined();
        expect(branched.thread.sandboxId).not.toBe(sourceThreadRecord?.thread.sandboxId);

        const flowDefinitions = await getPersistence().db.selectFrom('flow_definitions').selectAll().execute();
        const flowInstances = await getPersistence().db.selectFrom('flow_instances').selectAll().execute();
        expect(flowDefinitions).toHaveLength(0);
        expect(flowInstances).toHaveLength(0);
    });

    it('creates a permission request for branch workflows that need shell approval and keeps the branch', async () => {
        const caller = createCaller();
        vi.stubGlobal(
            'fetch',
            vi.fn(() =>
                Promise.resolve({
                    ok: true,
                    status: 200,
                    statusText: 'OK',
                    json: () => ({
                        choices: [
                            {
                                message: {
                                    content: 'assistant response',
                                },
                            },
                        ],
                        usage: {
                            prompt_tokens: 8,
                            completion_tokens: 12,
                            total_tokens: 20,
                        },
                    }),
                })
            )
        );
        const configured = await caller.provider.setApiKey({
            profileId,
            providerId: 'openai',
            apiKey: 'openai-branch-workflow-approval-key',
        });
        expect(configured.success).toBe(true);

        const created = await createSessionInScope(caller, profileId, {
            scope: 'workspace',
            workspaceFingerprint: 'ws_branch_workflow_approval',
            title: 'Workflow Branch Approval Thread',
            kind: 'local',
            topLevelTab: 'agent',
        });
        const workspaceFingerprint = 'ws_branch_workflow_approval';

        const run = await caller.session.startRun({
            profileId,
            sessionId: created.session.id,
            prompt: 'Need a workflow branch',
            topLevelTab: 'agent',
            modeKey: 'code',
            workspaceFingerprint,
            runtimeOptions: defaultRuntimeOptions,
            providerId: 'openai',
            modelId: 'openai/gpt-5',
        });
        expect(run.accepted).toBe(true);
        if (!run.accepted) {
            throw new Error('Expected source run to start.');
        }
        await waitForRunStatus(caller, profileId, created.session.id, 'completed');

        const branchWorkflow = await caller.branchWorkflow.create({
            profileId,
            workspaceFingerprint,
            label: 'Install deps',
            command: 'node -e "process.exit(0)"',
            enabled: true,
        });
        const messages = await caller.session.listMessages({
            profileId,
            sessionId: created.session.id,
        });
        const branchMessage = messages.messages.filter((message) => message.role === 'assistant').at(-1);
        if (!branchMessage) {
            throw new Error('Expected assistant message for branch target.');
        }

        const branched = await caller.session.branchFromMessageWithBranchWorkflow({
            profileId,
            sessionId: created.session.id,
            topLevelTab: 'agent',
            modeKey: 'code',
            messageId: branchMessage.id,
            branchWorkflowId: branchWorkflow.branchWorkflow.id,
        });
        expect(branched.branched).toBe(true);
        if (!branched.branched) {
            throw new Error(`Expected workflow branch to succeed, received "${branched.reason}".`);
        }
        expect(branched.branchWorkflowExecution.status).toBe('approval_required');
        if (branched.branchWorkflowExecution.status !== 'approval_required') {
            throw new Error('Expected workflow approval requirement.');
        }
        expect(branched.branchWorkflowExecution.flowDefinitionId).toBeDefined();
        expect(branched.branchWorkflowExecution.flowInstanceId).toBeDefined();
        if (!branched.branchWorkflowExecution.flowDefinitionId || !branched.branchWorkflowExecution.flowInstanceId) {
            throw new Error('Expected persisted flow provenance for approval-required branch workflow.');
        }
        const permissionRequestId = branched.branchWorkflowExecution.requestId;
        const resolvedPermission = await caller.permission.resolve({
            profileId,
            requestId: permissionRequestId,
            resolution: 'allow_once',
        });
        expect(resolvedPermission.updated).toBe(true);

        const flowDefinition = await getPersistence().db
            .selectFrom('flow_definitions')
            .selectAll()
            .where('id', '=', branched.branchWorkflowExecution.flowDefinitionId)
            .executeTakeFirstOrThrow();
        expect(flowDefinition.origin_kind).toBe('branch_workflow_adapter');
        expect(flowDefinition.profile_id).toBe(profileId);
        expect(flowDefinition.workspace_fingerprint).toBe(workspaceFingerprint);
        expect(flowDefinition.source_branch_workflow_id).toBe(branchWorkflow.branchWorkflow.id);
        expect(JSON.parse(flowDefinition.steps_json)).toEqual([
            {
                kind: 'legacy_command',
                id: `${branchWorkflow.branchWorkflow.id}:legacy_command`,
                label: 'Install deps',
                command: 'node -e "process.exit(0)"',
            },
        ]);

        const flowInstance = await getPersistence().db
            .selectFrom('flow_instances')
            .selectAll()
            .where('id', '=', branched.branchWorkflowExecution.flowInstanceId)
            .executeTakeFirstOrThrow();
        await waitForFlowInstanceStatus(flowInstance.id, 'completed');

        const completedFlowInstance = await getPersistence().db
            .selectFrom('flow_instances')
            .selectAll()
            .where('id', '=', branched.branchWorkflowExecution.flowInstanceId)
            .executeTakeFirstOrThrow();
        expect(completedFlowInstance.flow_definition_id).toBe(flowDefinition.id);
        expect(completedFlowInstance.status).toBe('completed');
        expect(completedFlowInstance.current_step_index).toBe(1);
        expect(completedFlowInstance.started_at).toBeDefined();
        expect(completedFlowInstance.finished_at).toBeDefined();

        const flowEvents = await getPersistence().db
            .selectFrom('runtime_events')
            .selectAll()
            .where('entity_type', '=', 'flow')
            .where('entity_id', '=', completedFlowInstance.id)
            .orderBy('sequence', 'asc')
            .execute();
        expect(flowEvents.map((event) => event.event_type)).toEqual([
            'flow.started',
            'flow.step_started',
            'flow.approval_required',
            'flow.step_completed',
            'flow.completed',
        ]);

        const branchStatus = await caller.session.status({
            profileId,
            sessionId: branched.sessionId,
        });
        expect(branchStatus.found).toBe(true);
    });

    it('keeps the new branch and leaves source state untouched when workflow execution fails', async () => {
        const caller = createCaller();
        vi.stubGlobal(
            'fetch',
            vi.fn(() =>
                Promise.resolve({
                    ok: true,
                    status: 200,
                    statusText: 'OK',
                    json: () => ({
                        choices: [
                            {
                                message: {
                                    content: 'assistant response',
                                },
                            },
                        ],
                        usage: {
                            prompt_tokens: 8,
                            completion_tokens: 12,
                            total_tokens: 20,
                        },
                    }),
                })
            )
        );
        const configured = await caller.provider.setApiKey({
            profileId,
            providerId: 'openai',
            apiKey: 'openai-branch-workflow-failure-key',
        });
        expect(configured.success).toBe(true);

        const created = await createSessionInScope(caller, profileId, {
            scope: 'workspace',
            workspaceFingerprint: 'ws_branch_workflow_failure',
            title: 'Workflow Branch Failure Thread',
            kind: 'local',
            topLevelTab: 'agent',
        });
        const workspaceFingerprint = 'ws_branch_workflow_failure';

        const run = await caller.session.startRun({
            profileId,
            sessionId: created.session.id,
            prompt: 'Run a workflow after branching',
            topLevelTab: 'agent',
            modeKey: 'code',
            workspaceFingerprint,
            runtimeOptions: defaultRuntimeOptions,
            providerId: 'openai',
            modelId: 'openai/gpt-5',
        });
        expect(run.accepted).toBe(true);
        if (!run.accepted) {
            throw new Error('Expected source run to start.');
        }
        await waitForRunStatus(caller, profileId, created.session.id, 'completed');

        const sourceThreadRecord = await threadStore.getBySessionId(profileId, created.session.id);
        const sourceSandboxId = sourceThreadRecord?.thread.sandboxId;
        const sourceRuns = await caller.session.listRuns({
            profileId,
            sessionId: created.session.id,
        });

        const shellApprovalContext = buildShellApprovalContext('definitely_missing_workflow_command');
        const workspaceResource = shellApprovalContext.approvalCandidates[0]?.resource;
        if (!workspaceResource) {
            throw new Error('Expected shell approval prefix resource.');
        }
        await caller.permission.setWorkspaceOverride({
            profileId,
            workspaceFingerprint,
            resource: workspaceResource,
            policy: 'allow',
        });

        const branchWorkflow = await caller.branchWorkflow.create({
            profileId,
            workspaceFingerprint,
            label: 'Broken workflow',
            command: 'definitely_missing_workflow_command',
            enabled: true,
        });
        const messages = await caller.session.listMessages({
            profileId,
            sessionId: created.session.id,
        });
        const branchMessage = messages.messages.filter((message) => message.role === 'assistant').at(-1);
        if (!branchMessage) {
            throw new Error('Expected assistant message for branch target.');
        }

        const branched = await caller.session.branchFromMessageWithBranchWorkflow({
            profileId,
            sessionId: created.session.id,
            topLevelTab: 'agent',
            modeKey: 'code',
            messageId: branchMessage.id,
            branchWorkflowId: branchWorkflow.branchWorkflow.id,
        });
        expect(branched.branched).toBe(true);
        if (!branched.branched) {
            throw new Error(`Expected workflow branch to succeed, received "${branched.reason}".`);
        }
        expect(branched.branchWorkflowExecution.status).toBe('failed');
        expect(branched.branchWorkflowExecution.flowDefinitionId).toBeDefined();
        expect(branched.branchWorkflowExecution.flowInstanceId).toBeDefined();
        if (!branched.branchWorkflowExecution.flowDefinitionId || !branched.branchWorkflowExecution.flowInstanceId) {
            throw new Error('Expected persisted flow provenance for failed branch workflow.');
        }
        expect(branched.sessionId).not.toBe(created.session.id);

        const flowDefinition = await getPersistence().db
            .selectFrom('flow_definitions')
            .selectAll()
            .where('id', '=', branched.branchWorkflowExecution.flowDefinitionId)
            .executeTakeFirstOrThrow();
        expect(flowDefinition.origin_kind).toBe('branch_workflow_adapter');
        expect(flowDefinition.profile_id).toBe(profileId);
        expect(flowDefinition.workspace_fingerprint).toBe(workspaceFingerprint);
        expect(flowDefinition.source_branch_workflow_id).toBe(branchWorkflow.branchWorkflow.id);

        const flowInstance = await getPersistence().db
            .selectFrom('flow_instances')
            .selectAll()
            .where('id', '=', branched.branchWorkflowExecution.flowInstanceId)
            .executeTakeFirstOrThrow();
        expect(flowInstance.flow_definition_id).toBe(flowDefinition.id);
        expect(flowInstance.status).toBe('failed');
        expect(flowInstance.current_step_index).toBe(0);
        expect(flowInstance.started_at).toBeDefined();
        expect(flowInstance.finished_at).toBeDefined();

        const flowEvents = await getPersistence().db
            .selectFrom('runtime_events')
            .selectAll()
            .where('entity_type', '=', 'flow')
            .where('entity_id', '=', flowInstance.id)
            .orderBy('sequence', 'asc')
            .execute();
        expect(flowEvents.map((event) => event.event_type)).toEqual(['flow.started', 'flow.step_started', 'flow.failed']);

        const sourceRunsAfterBranch = await caller.session.listRuns({
            profileId,
            sessionId: created.session.id,
        });
        expect(sourceRunsAfterBranch.runs.map((item) => item.id)).toEqual(sourceRuns.runs.map((item) => item.id));

        const sourceThreadAfterBranch = await threadStore.getBySessionId(profileId, created.session.id);
        expect(sourceThreadAfterBranch?.thread.sandboxId).toBe(sourceSandboxId);

        const branchStatus = await caller.session.status({
            profileId,
            sessionId: branched.sessionId,
        });
        expect(branchStatus.found).toBe(true);
    });
});
