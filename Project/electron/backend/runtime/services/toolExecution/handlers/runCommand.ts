import { err, type Result } from 'neverthrow';

import type { ToolExecutionFailure, ToolExecutionOutput } from '@/app/backend/runtime/services/toolExecution/types';

export function runCommandToolHandler(): Promise<Result<ToolExecutionOutput, ToolExecutionFailure>> {
    return Promise.resolve(
        err({
            code: 'not_implemented',
            message: 'Tool "run_command" is not implemented yet.',
        })
    );
}
