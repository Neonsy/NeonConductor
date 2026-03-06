import type { ToolExecutionOutput, ToolExecutionResult } from '@/app/backend/runtime/services/toolExecution/types';

export function okToolResult(input: {
    toolId: string;
    output: ToolExecutionOutput;
    at: string;
    policy: { effective: 'ask' | 'allow' | 'deny'; source: string };
}): ToolExecutionResult {
    return {
        ok: true,
        toolId: input.toolId,
        output: input.output,
        at: input.at,
        policy: input.policy,
    };
}

export function errorToolResult(input: {
    toolId: string;
    error:
        | 'tool_not_found'
        | 'policy_denied'
        | 'permission_required'
        | 'invalid_args'
        | 'not_implemented'
        | 'execution_failed';
    message: string;
    args: Record<string, unknown>;
    at: string;
    policy?: { effective: 'ask' | 'allow' | 'deny'; source: string };
    requestId?: string;
}): ToolExecutionResult {
    return {
        ok: false,
        toolId: input.toolId,
        error: input.error,
        message: input.message,
        args: input.args,
        at: input.at,
        ...(input.policy ? { policy: input.policy } : {}),
        ...(input.requestId ? { requestId: input.requestId } : {}),
    };
}
