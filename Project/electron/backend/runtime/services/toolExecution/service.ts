import { permissionStore, workspaceRootStore } from '@/app/backend/persistence/stores';
import type { ToolInvokeInput } from '@/app/backend/runtime/contracts';
import { getExecutionPreset } from '@/app/backend/runtime/services/profile/executionPreset';
import { resolveEffectivePermissionPolicy } from '@/app/backend/runtime/services/permissions/policyResolver';
import {
    emitPermissionRequestedEvent,
    emitToolBlockedEvent,
    emitToolCompletedEvent,
    emitToolFailedEvent,
} from '@/app/backend/runtime/services/toolExecution/events';
import { invokeToolHandler } from '@/app/backend/runtime/services/toolExecution/handlers';
import { findToolById } from '@/app/backend/runtime/services/toolExecution/lookup';
import { errorToolResult, okToolResult } from '@/app/backend/runtime/services/toolExecution/results';
import { buildShellApprovalContext } from '@/app/backend/runtime/services/toolExecution/shellApproval';
import { isIgnoredWorkspacePath, isPathInsideWorkspace, resolveWorkspaceToolPath } from '@/app/backend/runtime/services/toolExecution/safety';
import type { ToolExecutionResult } from '@/app/backend/runtime/services/toolExecution/types';
import { appLog } from '@/app/main/logging';

function toolLogContext(input: ToolInvokeInput, toolId: string, source?: string) {
    return {
        profileId: input.profileId,
        toolId,
        ...(source ? { source } : {}),
        topLevelTab: input.topLevelTab,
        modeKey: input.modeKey,
    };
}

type ToolDecision =
    | {
          kind: 'allow';
          policy: { effective: 'allow'; source: string };
          resource: string;
      }
    | {
          kind: 'deny';
          policy: { effective: 'deny'; source: string };
          resource: string;
          reason:
              | 'policy_denied'
              | 'detached_scope'
              | 'workspace_unresolved'
              | 'outside_workspace'
              | 'ignored_path';
          message: string;
      }
    | {
          kind: 'ask';
          policy: { effective: 'ask'; source: string };
          resource: string;
          scopeKind: 'tool' | 'boundary';
          summary: {
              title: string;
              detail: string;
          };
          approvalCandidates?: NonNullable<Awaited<ReturnType<typeof permissionStore.create>>['approvalCandidates']>;
          commandText?: string;
          message: string;
      };

function boundaryResource(toolId: string, boundary: 'workspace_required' | 'outside_workspace' | 'ignored_path'): string {
    return `tool:${toolId}:boundary:${boundary}`;
}

function boundaryDefaultPolicy(executionPreset: 'privacy' | 'standard' | 'yolo'): 'ask' | 'deny' {
    if (executionPreset === 'yolo') {
        return 'deny';
    }

    return 'ask';
}

export class ToolExecutionService {
    async invoke(input: ToolInvokeInput): Promise<ToolExecutionResult> {
        const at = new Date().toISOString();
        const args = input.args ?? {};
        const definition = await findToolById(input.toolId);

        if (!definition) {
            appLog.warn({
                tag: 'tool-execution',
                message: 'Rejected tool invocation because tool was not found.',
                ...toolLogContext(input, input.toolId),
            });
            return errorToolResult({
                toolId: input.toolId,
                error: 'tool_not_found',
                message: `Tool "${input.toolId}" was not found.`,
                args,
                at,
            });
        }

        const executionPreset = await getExecutionPreset(input.profileId);
        let workspaceRootPath: string | undefined;
        let workspaceLabel: string | undefined;
        const resolveDecision = async (decisionInput: {
            resource: string;
            resourceCandidates?: string[];
            onceResource?: string;
            scopeKind: 'tool' | 'boundary';
            defaultPolicy: 'ask' | 'allow' | 'deny';
            summary: {
                title: string;
                detail: string;
            };
            approvalCandidates?: NonNullable<Awaited<ReturnType<typeof permissionStore.create>>['approvalCandidates']>;
            commandText?: string;
            denyMessage: string;
            askMessage: string;
            denyReason?: 'policy_denied' | 'outside_workspace' | 'ignored_path';
        }): Promise<ToolDecision> => {
            const resolvedPolicy = await resolveEffectivePermissionPolicy({
                profileId: input.profileId,
                resource: decisionInput.resource,
                ...(decisionInput.resourceCandidates ? { resourceCandidates: decisionInput.resourceCandidates } : {}),
                topLevelTab: input.topLevelTab,
                modeKey: input.modeKey,
                executionPreset,
                capabilities: definition.tool.capabilities,
                toolDefaultPolicy: decisionInput.defaultPolicy,
                ...(input.workspaceFingerprint ? { workspaceFingerprint: input.workspaceFingerprint } : {}),
            });

            if (resolvedPolicy.policy === 'ask') {
                const onceApproval = await permissionStore.consumeGrantedOnce({
                    profileId: input.profileId,
                    resource: decisionInput.onceResource ?? decisionInput.resource,
                    ...(input.workspaceFingerprint ? { workspaceFingerprint: input.workspaceFingerprint } : {}),
                });
                if (onceApproval) {
                    return {
                        kind: 'allow',
                        policy: {
                            effective: 'allow',
                            source: 'one_time_approval',
                        },
                        resource: decisionInput.onceResource ?? decisionInput.resource,
                    };
                }

                return {
                    kind: 'ask',
                    policy: {
                        effective: 'ask',
                        source: resolvedPolicy.source,
                    },
                    resource: decisionInput.onceResource ?? decisionInput.resource,
                    scopeKind: decisionInput.scopeKind,
                    summary: decisionInput.summary,
                    ...(decisionInput.approvalCandidates ? { approvalCandidates: decisionInput.approvalCandidates } : {}),
                    ...(decisionInput.commandText ? { commandText: decisionInput.commandText } : {}),
                    message: decisionInput.askMessage,
                };
            }

            if (resolvedPolicy.policy === 'deny') {
                return {
                    kind: 'deny',
                    policy: {
                        effective: 'deny',
                        source: resolvedPolicy.source,
                    },
                    resource: resolvedPolicy.resource,
                    reason: decisionInput.denyReason ?? 'policy_denied',
                    message: decisionInput.denyMessage,
                };
            }

            return {
                kind: 'allow',
                policy: {
                    effective: 'allow',
                    source: resolvedPolicy.source,
                },
                resource: resolvedPolicy.resource,
            };
        };

        let executionArgs = args;
        if (definition.tool.requiresWorkspace) {
            if (!input.workspaceFingerprint) {
                const policy = {
                    effective: 'deny',
                    source: 'detached_scope',
                } as const;
                await emitToolBlockedEvent({
                    toolId: definition.tool.id,
                    profileId: input.profileId,
                    resource: boundaryResource(definition.tool.id, 'workspace_required'),
                    policy: 'deny',
                    source: policy.source,
                    reason: 'detached_scope',
                });

                return errorToolResult({
                    toolId: definition.tool.id,
                    error: 'policy_denied',
                    message: `Tool "${definition.tool.id}" requires a workspace-bound thread. Detached chat has no file authority.`,
                    args,
                    at,
                    policy,
                });
            }

            const workspaceRoot = await workspaceRootStore.getByFingerprint(input.profileId, input.workspaceFingerprint);
            if (!workspaceRoot) {
                const policy = {
                    effective: 'deny',
                    source: 'workspace_unresolved',
                } as const;
                await emitToolBlockedEvent({
                    toolId: definition.tool.id,
                    profileId: input.profileId,
                    resource: boundaryResource(definition.tool.id, 'workspace_required'),
                    policy: 'deny',
                    source: policy.source,
                    reason: 'workspace_unresolved',
                });

                return errorToolResult({
                    toolId: definition.tool.id,
                    error: 'policy_denied',
                    message: `Tool "${definition.tool.id}" could not resolve the workspace root for this thread.`,
                    args,
                    at,
                    policy,
                });
            }

            workspaceRootPath = workspaceRoot.absolutePath;
            workspaceLabel = workspaceRoot.label;

            if (definition.tool.id === 'read_file' || definition.tool.id === 'list_files') {
                const requestedPath = typeof args['path'] === 'string' ? args['path'] : undefined;
                const resolvedPath = resolveWorkspaceToolPath(
                    requestedPath
                        ? {
                              workspaceRootPath: workspaceRoot.absolutePath,
                              targetPath: requestedPath,
                          }
                        : {
                              workspaceRootPath: workspaceRoot.absolutePath,
                          }
                );

                if (
                    !definition.tool.allowsExternalPaths &&
                    !isPathInsideWorkspace(resolvedPath.absolutePath, resolvedPath.workspaceRootPath)
                ) {
                    const decision = await resolveDecision({
                        resource: boundaryResource(definition.tool.id, 'outside_workspace'),
                        scopeKind: 'boundary',
                        defaultPolicy: boundaryDefaultPolicy(executionPreset),
                        summary: {
                            title: 'Outside Workspace Access',
                            detail: `${definition.tool.label} wants to access a path outside ${workspaceRoot.label}.`,
                        },
                        denyMessage: `Tool "${definition.tool.id}" cannot access paths outside the registered workspace root in the current safety preset.`,
                        askMessage: `Tool "${definition.tool.id}" needs approval to access a path outside the registered workspace root.`,
                        denyReason: 'outside_workspace',
                    });

                    if (decision.kind !== 'allow') {
                        if (decision.kind === 'ask') {
                            const request = await permissionStore.create({
                                profileId: input.profileId,
                                policy: 'ask',
                                resource: decision.resource,
                                toolId: definition.tool.id,
                                scopeKind: decision.scopeKind,
                                summary: decision.summary,
                                workspaceFingerprint: input.workspaceFingerprint,
                                rationale: decision.message,
                            });
                            await emitPermissionRequestedEvent({ request, toolId: definition.tool.id });
                            await emitToolBlockedEvent({
                                toolId: definition.tool.id,
                                profileId: input.profileId,
                                resource: decision.resource,
                                policy: 'ask',
                                source: decision.policy.source,
                                reason: 'permission_required',
                                requestId: request.id,
                            });

                            return errorToolResult({
                                toolId: definition.tool.id,
                                error: 'permission_required',
                                message: decision.message,
                                args,
                                at,
                                requestId: request.id,
                                policy: decision.policy,
                            });
                        }

                        await emitToolBlockedEvent({
                            toolId: definition.tool.id,
                            profileId: input.profileId,
                            resource: decision.resource,
                            policy: 'deny',
                            source: decision.policy.source,
                            reason: decision.reason,
                        });

                        return errorToolResult({
                            toolId: definition.tool.id,
                            error: 'policy_denied',
                            message: decision.message,
                            args,
                            at,
                            policy: decision.policy,
                        });
                    }
                }

                if (
                    !definition.tool.allowsIgnoredPaths &&
                    isIgnoredWorkspacePath(resolvedPath.absolutePath, resolvedPath.workspaceRootPath)
                ) {
                    const decision = await resolveDecision({
                        resource: boundaryResource(definition.tool.id, 'ignored_path'),
                        scopeKind: 'boundary',
                        defaultPolicy: boundaryDefaultPolicy(executionPreset),
                        summary: {
                            title: 'Ignored Path Access',
                            detail: `${definition.tool.label} wants to access an ignored path inside ${workspaceRoot.label}.`,
                        },
                        denyMessage: `Tool "${definition.tool.id}" cannot access ignored paths in the current safety preset.`,
                        askMessage: `Tool "${definition.tool.id}" needs approval to access an ignored path.`,
                        denyReason: 'ignored_path',
                    });

                    if (decision.kind !== 'allow') {
                        if (decision.kind === 'ask') {
                            const request = await permissionStore.create({
                                profileId: input.profileId,
                                policy: 'ask',
                                resource: decision.resource,
                                toolId: definition.tool.id,
                                scopeKind: decision.scopeKind,
                                summary: decision.summary,
                                workspaceFingerprint: input.workspaceFingerprint,
                                rationale: decision.message,
                            });
                            await emitPermissionRequestedEvent({ request, toolId: definition.tool.id });
                            await emitToolBlockedEvent({
                                toolId: definition.tool.id,
                                profileId: input.profileId,
                                resource: decision.resource,
                                policy: 'ask',
                                source: decision.policy.source,
                                reason: 'permission_required',
                                requestId: request.id,
                            });

                            return errorToolResult({
                                toolId: definition.tool.id,
                                error: 'permission_required',
                                message: decision.message,
                                args,
                                at,
                                requestId: request.id,
                                policy: decision.policy,
                            });
                        }

                        await emitToolBlockedEvent({
                            toolId: definition.tool.id,
                            profileId: input.profileId,
                            resource: decision.resource,
                            policy: 'deny',
                            source: decision.policy.source,
                            reason: decision.reason,
                        });

                        return errorToolResult({
                            toolId: definition.tool.id,
                            error: 'policy_denied',
                            message: decision.message,
                            args,
                            at,
                            policy: decision.policy,
                        });
                    }
                }

                executionArgs = {
                    ...args,
                    path: resolvedPath.absolutePath,
                };
            }
        }

        const shellApprovalContext =
            definition.tool.id === 'run_command'
                ? (() => {
                      const commandArg = typeof args['command'] === 'string' ? args['command'].trim() : '';
                      return commandArg.length > 0 ? buildShellApprovalContext(commandArg) : null;
                  })()
                : null;
        if (definition.tool.id === 'run_command' && !shellApprovalContext) {
            return errorToolResult({
                toolId: definition.tool.id,
                error: 'invalid_args',
                message: 'Missing "command" argument.',
                args,
                at,
            });
        }

        const decision = await resolveDecision({
            resource: shellApprovalContext?.commandResource ?? definition.resource,
            ...(shellApprovalContext?.overrideResources.length
                ? { resourceCandidates: shellApprovalContext.overrideResources }
                : {}),
            ...(shellApprovalContext?.commandResource ? { onceResource: shellApprovalContext.commandResource } : {}),
            scopeKind: 'tool',
            defaultPolicy: definition.tool.permissionPolicy,
            summary: {
                title:
                    definition.tool.id === 'run_command'
                        ? 'Shell Command Approval'
                        : `${definition.tool.label} Request`,
                detail:
                    definition.tool.id === 'run_command'
                        ? `${executionPreset} preset requires approval for "${shellApprovalContext?.commandText ?? ''}" in ${workspaceLabel ?? 'the active workspace'}.`
                        : `${definition.tool.label} wants to run in ${input.topLevelTab}/${input.modeKey}.`,
            },
            ...(shellApprovalContext?.approvalCandidates
                ? { approvalCandidates: shellApprovalContext.approvalCandidates }
                : {}),
            ...(shellApprovalContext?.commandText ? { commandText: shellApprovalContext.commandText } : {}),
            denyMessage:
                definition.tool.id === 'run_command'
                    ? 'Tool "run_command" is only available in workspace-bound agent.code and agent.debug sessions.'
                    : `Tool "${definition.tool.id}" is denied by current safety policy.`,
            askMessage:
                definition.tool.id === 'run_command'
                    ? `Shell approval is required before running "${shellApprovalContext?.commandText ?? ''}"${workspaceRootPath ? ` in ${workspaceRootPath}` : ''}.`
                    : `Tool "${definition.tool.id}" requires permission approval.`,
        });

        if (decision.kind === 'deny') {
            await emitToolBlockedEvent({
                toolId: definition.tool.id,
                profileId: input.profileId,
                resource: decision.resource,
                policy: 'deny',
                source: decision.policy.source,
                reason: decision.reason,
            });

            appLog.warn({
                tag: 'tool-execution',
                message: 'Blocked tool invocation by deny policy.',
                ...toolLogContext(input, definition.tool.id, decision.policy.source),
            });
            return errorToolResult({
                toolId: definition.tool.id,
                error: 'policy_denied',
                message: decision.message,
                args,
                at,
                policy: decision.policy,
            });
        }

        if (decision.kind === 'ask') {
            const request = await permissionStore.create({
                profileId: input.profileId,
                policy: 'ask',
                resource: decision.resource,
                toolId: definition.tool.id,
                scopeKind: decision.scopeKind,
                summary: decision.summary,
                ...(decision.commandText ? { commandText: decision.commandText } : {}),
                ...(decision.approvalCandidates ? { approvalCandidates: decision.approvalCandidates } : {}),
                ...(input.workspaceFingerprint ? { workspaceFingerprint: input.workspaceFingerprint } : {}),
                rationale: decision.message,
            });

            await emitPermissionRequestedEvent({
                request,
                toolId: definition.tool.id,
            });
            await emitToolBlockedEvent({
                toolId: definition.tool.id,
                profileId: input.profileId,
                resource: decision.resource,
                policy: 'ask',
                source: decision.policy.source,
                reason: 'permission_required',
                requestId: request.id,
            });

            appLog.info({
                tag: 'tool-execution',
                message: 'Tool invocation requires permission approval.',
                ...toolLogContext(input, definition.tool.id, decision.policy.source),
                requestId: request.id,
            });
            return errorToolResult({
                toolId: definition.tool.id,
                error: 'permission_required',
                message: decision.message,
                args,
                at,
                requestId: request.id,
                policy: decision.policy,
            });
        }

        const execution = await invokeToolHandler(definition.tool, executionArgs, {
            ...(workspaceRootPath ? { cwd: workspaceRootPath } : {}),
        });
        if (execution.isOk()) {
            await emitToolCompletedEvent({
                toolId: definition.tool.id,
                profileId: input.profileId,
                resource: decision.resource,
                policy: 'allow',
                source: decision.policy.source,
            });

            appLog.debug({
                tag: 'tool-execution',
                message: 'Completed tool invocation.',
                ...toolLogContext(input, definition.tool.id, decision.policy.source),
            });
            return okToolResult({
                toolId: definition.tool.id,
                output: execution.value,
                at,
                policy: decision.policy,
            });
        }

        await emitToolFailedEvent({
            toolId: definition.tool.id,
            profileId: input.profileId,
            resource: decision.resource,
            policy: 'allow',
            source: decision.policy.source,
            error: execution.error.message,
        });

        appLog.warn({
            tag: 'tool-execution',
            message: 'Tool invocation failed.',
            ...toolLogContext(input, definition.tool.id, decision.policy.source),
            errorCode: execution.error.code,
            errorMessage: execution.error.message,
        });
        return errorToolResult({
            toolId: definition.tool.id,
            error: execution.error.code,
            message: execution.error.message,
            args,
            at,
            policy: decision.policy,
        });
    }
}

export const toolExecutionService = new ToolExecutionService();
