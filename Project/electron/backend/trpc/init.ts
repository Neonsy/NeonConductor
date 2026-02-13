/**
 * tRPC initialization.
 * Creates the base router and procedure builders used by all routers.
 */

import { initTRPC } from '@trpc/server';
import { createRequestLogger } from 'evlog';
import { randomUUID } from 'node:crypto';

import type { Context } from '@/app/backend/trpc/context';
import { isAppLoggerEnabled } from '@/app/main/logging';

const t = initTRPC.context<Context>().create({
    // Marks this as server-side (main process) for tRPC internals
    isServer: true,
});

const TRPC_STATUS_BY_CODE: Record<string, number> = {
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    TIMEOUT: 408,
    CONFLICT: 409,
    TOO_MANY_REQUESTS: 429,
};

function mapTrpcCodeToStatus(code: unknown): number {
    if (typeof code !== 'string') {
        return 500;
    }

    return TRPC_STATUS_BY_CODE[code] ?? 500;
}

function extractErrorCode(error: unknown): string | undefined {
    if (!error || typeof error !== 'object' || !('code' in error)) {
        return undefined;
    }

    const { code } = error as { code?: unknown };
    return typeof code === 'string' ? code : undefined;
}

function normalizeError(error: unknown): Error {
    if (error instanceof Error) {
        return error;
    }

    return new Error(typeof error === 'string' ? error : 'Unknown tRPC error');
}

const trpcRequestLoggingMiddleware = t.middleware(async (opts) => {
    if (!isAppLoggerEnabled()) {
        return opts.next();
    }

    const requestId = randomUUID();
    const requestLog = createRequestLogger({
        method: opts.type.toUpperCase(),
        path: `trpc.${opts.path}`,
        requestId,
    });

    requestLog.set({
        senderId: opts.ctx.senderId,
        ...(opts.ctx.win?.id ? { windowId: opts.ctx.win.id } : {}),
    });

    try {
        const result = await opts.next();

        if (result.ok) {
            requestLog.emit({ status: 200 });
            return result;
        }

        const errorCode = extractErrorCode(result.error);

        requestLog.error(normalizeError(result.error), {
            ...(errorCode ? { trpcCode: errorCode } : {}),
        });
        requestLog.emit({ status: mapTrpcCodeToStatus(errorCode) });

        return result;
    } catch (error: unknown) {
        const errorCode = extractErrorCode(error);

        requestLog.error(normalizeError(error), {
            ...(errorCode ? { trpcCode: errorCode } : {}),
        });
        requestLog.emit({ status: mapTrpcCodeToStatus(errorCode) });

        throw error;
    }
});

export const router = t.router;
export const publicProcedure = t.procedure.use(trpcRequestLoggingMiddleware);
export const middleware = t.middleware;
