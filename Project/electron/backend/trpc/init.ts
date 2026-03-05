/**
 * tRPC initialization.
 * Creates the base router and procedure builders used by all routers.
 */

import { initTRPC } from '@trpc/server';
import { createRequestLogger } from 'evlog';

import type { Context } from '@/app/backend/trpc/context';
import { extractErrorCode, toTrpcError } from '@/app/backend/trpc/trpcErrorMap';
import { isAppLoggerEnabled } from '@/app/main/logging';

const t = initTRPC.context<Context>().create({
    // Marks this as server-side (main process) for tRPC internals
    isServer: true,
});

const TRPC_STATUS_BY_CODE = new Map<string, number>([
    ['BAD_REQUEST', 400],
    ['UNAUTHORIZED', 401],
    ['FORBIDDEN', 403],
    ['NOT_FOUND', 404],
    ['TIMEOUT', 408],
    ['CONFLICT', 409],
    ['TOO_MANY_REQUESTS', 429],
    ['INTERNAL_SERVER_ERROR', 500],
]);

function mapTrpcCodeToStatus(code: unknown): number {
    if (typeof code !== 'string') {
        return 500;
    }

    return TRPC_STATUS_BY_CODE.get(code) ?? 500;
}

function normalizeError(error: unknown): Error {
    if (error instanceof Error) {
        return error;
    }

    return new Error(typeof error === 'string' ? error : 'Unknown tRPC error');
}

function normalizeBoundaryError(error: unknown): Error {
    return toTrpcError(error);
}

const trpcRequestLoggingMiddleware = t.middleware(async (opts) => {
    if (!isAppLoggerEnabled()) {
        return opts.next();
    }

    const requestId = opts.ctx.requestId;
    const requestLog = createRequestLogger({
        method: opts.type.toUpperCase(),
        path: `trpc.${opts.path}`,
        requestId,
    });

    requestLog.set({
        senderId: opts.ctx.senderId,
        correlationId: opts.ctx.correlationId,
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
        const normalizedError = normalizeBoundaryError(error);
        const errorCode = extractErrorCode(normalizedError);

        requestLog.error(normalizedError, {
            ...(errorCode ? { trpcCode: errorCode } : {}),
        });
        requestLog.emit({ status: mapTrpcCodeToStatus(errorCode) });

        throw normalizedError;
    }
});

export const router = t.router;
export const publicProcedure = t.procedure.use(trpcRequestLoggingMiddleware);
export const middleware = t.middleware;
