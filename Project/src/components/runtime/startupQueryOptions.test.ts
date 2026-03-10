import { describe, expect, it } from 'vitest';

import { BOOT_CRITICAL_QUERY_OPTIONS } from '@/web/components/runtime/startupQueryOptions';

describe('startupQueryOptions', () => {
    it('disables retry for boot-critical queries', () => {
        expect(BOOT_CRITICAL_QUERY_OPTIONS).toEqual({
            refetchOnWindowFocus: false,
            retry: false,
        });
    });
});
