import { err, ok, type Result } from 'neverthrow';

import { vendoredNodeCodeRunner } from '@/app/backend/runtime/services/codeExecution/vendoredNodeCodeRunner';
import { readNumberArg, readStringArg } from '@/app/backend/runtime/services/toolExecution/args';
import type { ToolExecutionFailure, ToolExecutionOutput } from '@/app/backend/runtime/services/toolExecution/types';

function readOptionalTimeoutMs(args: Record<string, unknown>): number | undefined {
    const rawTimeoutMs = args['timeoutMs'];
    if (rawTimeoutMs === undefined) {
        return undefined;
    }

    return readNumberArg(args, 'timeoutMs', 0);
}

export async function executeCodeToolHandler(
    args: Record<string, unknown>
): Promise<Result<ToolExecutionOutput, ToolExecutionFailure>> {
    const code = readStringArg(args, 'code');
    if (!code || code.trim().length === 0) {
        return err({
            code: 'invalid_args',
            message: 'Missing "code" argument.',
        });
    }

    const timeoutMs = readOptionalTimeoutMs(args);
    const execution = await vendoredNodeCodeRunner.execute({
        code,
        ...(timeoutMs === undefined ? {} : { timeoutMs }),
    });
    if (execution.isErr()) {
        return err(execution.error);
    }

    return ok({
        runtime: execution.value.runtime,
        runtimeVersion: execution.value.runtimeVersion,
        result: execution.value.result,
        resultSerialization: execution.value.resultSerialization,
        resultBytes: execution.value.resultBytes,
        resultTruncated: execution.value.resultTruncated,
        logs: execution.value.logs,
        logsTruncated: execution.value.logsTruncated,
        stderr: execution.value.stderr,
        stderrBytes: execution.value.stderrBytes,
        stderrTruncated: execution.value.stderrTruncated,
        timedOut: execution.value.timedOut,
        durationMs: execution.value.durationMs,
        ...(execution.value.error ? { error: execution.value.error } : {}),
    });
}
