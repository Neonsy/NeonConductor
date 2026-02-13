import { describe, expect, it } from 'vitest';

import { isAppNavigation, isSafeExternalUrl } from '@/app/main/security/urlPolicy';

describe('isSafeExternalUrl', () => {
    it('allows http, https, and mailto', () => {
        expect(isSafeExternalUrl('https://example.com')).toBe(true);
        expect(isSafeExternalUrl('http://example.com')).toBe(true);
        expect(isSafeExternalUrl('mailto:hello@example.com')).toBe(true);
    });

    it('blocks non-allowlisted protocols', () => {
        expect(isSafeExternalUrl('file:///C:/secret.txt')).toBe(false);
        expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false);
        expect(isSafeExternalUrl('custom://app')).toBe(false);
    });
});

describe('isAppNavigation', () => {
    it('accepts dev server origin in dev', () => {
        expect(isAppNavigation('http://localhost:5173/#/', 'http://localhost:5173')).toBe(true);
        expect(isAppNavigation('http://localhost:5174/#/', 'http://localhost:5173')).toBe(false);
    });

    it('accepts file URLs in prod', () => {
        expect(isAppNavigation('file:///C:/app/dist/index.html')).toBe(true);
        expect(isAppNavigation('https://example.com')).toBe(false);
    });
});
