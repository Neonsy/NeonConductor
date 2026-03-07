import { err, type Result } from 'neverthrow';

import type { ToolRecord } from '@/app/backend/persistence/types';
import { listFilesToolHandler } from '@/app/backend/runtime/services/toolExecution/handlers/listFiles';
import { readFileToolHandler } from '@/app/backend/runtime/services/toolExecution/handlers/readFile';
import { runCommandToolHandler } from '@/app/backend/runtime/services/toolExecution/handlers/runCommand';
import type { ToolExecutionFailure, ToolExecutionOutput } from '@/app/backend/runtime/services/toolExecution/types';

export function invokeToolHandler(
    tool: ToolRecord,
    args: Record<string, unknown>,
    context?: {
        cwd?: string;
    }
): Promise<Result<ToolExecutionOutput, ToolExecutionFailure>> {
    if (tool.id === 'list_files') {
        return listFilesToolHandler(args);
    }

    if (tool.id === 'read_file') {
        return readFileToolHandler(args);
    }

    if (tool.id === 'run_command') {
        if (!context?.cwd) {
            return Promise.resolve(
                err({
                    code: 'execution_failed',
                    message: 'Tool "run_command" requires a resolved workspace root.',
                })
            );
        }

        return runCommandToolHandler(args, { cwd: context.cwd });
    }

    return Promise.resolve(
        err({
            code: 'not_implemented',
            message: `Tool "${tool.id}" is not implemented.`,
        })
    );
}
