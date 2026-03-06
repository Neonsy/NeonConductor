import { err, ok, type Result } from 'neverthrow';
import path from 'node:path';

import type { ToolExecutionFailure } from '@/app/backend/runtime/services/toolExecution/types';

export function readStringArg(args: Record<string, unknown>, key: string): string | undefined {
    const value = args[key];
    if (value === undefined) {
        return undefined;
    }

    return typeof value === 'string' ? value.trim() : undefined;
}

export function readBooleanArg(args: Record<string, unknown>, key: string, fallback: boolean): boolean {
    const value = args[key];
    return typeof value === 'boolean' ? value : fallback;
}

export function readNumberArg(args: Record<string, unknown>, key: string, fallback: number): number {
    const value = args[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    return fallback;
}

function normalizeToolPath(targetPath: string | undefined): string {
    if (!targetPath || targetPath.length === 0) {
        return process.cwd();
    }

    if (path.isAbsolute(targetPath)) {
        return path.normalize(targetPath);
    }

    return path.resolve(process.cwd(), targetPath);
}

export function resolveAbsoluteToolPath(targetPath: string | undefined): Result<string, ToolExecutionFailure> {
    const normalizedPath = normalizeToolPath(targetPath);
    if (!path.isAbsolute(normalizedPath)) {
        return err({
            code: 'invalid_args',
            message: 'Tool path must resolve to an absolute path.',
        });
    }

    return ok(path.normalize(normalizedPath));
}
