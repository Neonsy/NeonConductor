import { permissionStore } from '@/app/backend/persistence/stores';
import type { ToolInvokeInput } from '@/app/backend/runtime/contracts';
import {
    emitPermissionRequestedEvent,
    emitToolBlockedEvent,
    emitToolCompletedEvent,
    emitToolFailedEvent,
} from '@/app/backend/runtime/services/toolExecution/events';
import { invokeToolHandler } from '@/app/backend/runtime/services/toolExecution/handlers';
import { findToolById } from '@/app/backend/runtime/services/toolExecution/lookup';
import { resolveToolPolicy } from '@/app/backend/runtime/services/toolExecution/policy';
import { errorToolResult, okToolResult } from '@/app/backend/runtime/services/toolExecution/results';
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

        const resolvedPolicy = await resolveToolPolicy({
            request: input,
            definition,
        });
        const policy = {
            effective: resolvedPolicy.policy,
            source: resolvedPolicy.source,
        } as const;

        if (resolvedPolicy.policy === 'deny') {
            await emitToolBlockedEvent({
                toolId: definition.tool.id,
                profileId: input.profileId,
                resource: definition.resource,
                policy: resolvedPolicy.policy,
                source: resolvedPolicy.source,
                reason: 'policy_denied',
            });

            appLog.warn({
                tag: 'tool-execution',
                message: 'Blocked tool invocation by deny policy.',
                ...toolLogContext(input, definition.tool.id, resolvedPolicy.source),
            });
            return errorToolResult({
                toolId: definition.tool.id,
                error: 'policy_denied',
                message: `Tool "${definition.tool.id}" is denied by current policy (${resolvedPolicy.source}).`,
                args,
                at,
                policy,
            });
        }

        if (resolvedPolicy.policy === 'ask') {
            const request = await permissionStore.create({
                policy: 'ask',
                resource: definition.resource,
                rationale: `Tool invocation requires confirmation (${definition.tool.id}).`,
            });

            await emitPermissionRequestedEvent({
                request,
                toolId: definition.tool.id,
            });
            await emitToolBlockedEvent({
                toolId: definition.tool.id,
                profileId: input.profileId,
                resource: definition.resource,
                policy: resolvedPolicy.policy,
                source: resolvedPolicy.source,
                reason: 'permission_required',
                requestId: request.id,
            });

            appLog.info({
                tag: 'tool-execution',
                message: 'Tool invocation requires permission approval.',
                ...toolLogContext(input, definition.tool.id, resolvedPolicy.source),
                requestId: request.id,
            });
            return errorToolResult({
                toolId: definition.tool.id,
                error: 'permission_required',
                message: `Tool "${definition.tool.id}" requires permission approval.`,
                args,
                at,
                requestId: request.id,
                policy,
            });
        }

        const execution = await invokeToolHandler(definition.tool, args);
        if (execution.isOk()) {
            await emitToolCompletedEvent({
                toolId: definition.tool.id,
                profileId: input.profileId,
                resource: definition.resource,
                policy: resolvedPolicy.policy,
                source: resolvedPolicy.source,
            });

            appLog.debug({
                tag: 'tool-execution',
                message: 'Completed tool invocation.',
                ...toolLogContext(input, definition.tool.id, resolvedPolicy.source),
            });
            return okToolResult({
                toolId: definition.tool.id,
                output: execution.value,
                at,
                policy,
            });
        }

        await emitToolFailedEvent({
            toolId: definition.tool.id,
            profileId: input.profileId,
            resource: definition.resource,
            policy: resolvedPolicy.policy,
            source: resolvedPolicy.source,
            error: execution.error.message,
        });

        appLog.warn({
            tag: 'tool-execution',
            message: 'Tool invocation failed.',
            ...toolLogContext(input, definition.tool.id, resolvedPolicy.source),
            errorCode: execution.error.code,
            errorMessage: execution.error.message,
        });
        return errorToolResult({
            toolId: definition.tool.id,
            error: execution.error.code,
            message: execution.error.message,
            args,
            at,
            policy,
        });
    }
}

export const toolExecutionService = new ToolExecutionService();
