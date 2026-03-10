import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('splash styles', () => {
    it('keeps a single full-window surface treatment without an inner card effect', () => {
        const source = readFileSync(path.join(process.cwd(), 'src/splash/styles.css'), 'utf8');

        expect(source).not.toContain('backdrop-filter');
        expect(source).not.toContain('box-shadow: 0 28px 80px');
        expect(source).not.toContain('rgba(9, 11, 18, 0.88)');
    });
});
