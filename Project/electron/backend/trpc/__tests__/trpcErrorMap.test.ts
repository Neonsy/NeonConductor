import { describe, expect, it } from 'vitest';

import { extractErrorCode, toTrpcError } from '@/app/backend/trpc/trpcErrorMap';

describe('trpcErrorMap', () => {
    it('extracts only known operational error codes', () => {
        expect(extractErrorCode({ code: 'provider_not_registered' })).toBe('provider_not_registered');
        expect(extractErrorCode({ code: 'definitely_not_real' })).toBeUndefined();
    });

    it('maps invalid input-like errors to BAD_REQUEST without throwing', () => {
        const error = toTrpcError(new Error('Invalid "profileId": expected non-empty string.'));
        expect(error.code).toBe('BAD_REQUEST');
    });
});
