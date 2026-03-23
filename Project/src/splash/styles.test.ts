import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('splash styles', () => {
    it('keeps a single full-window surface treatment without an inner card effect', () => {
        const source = readFileSync(path.join(process.cwd(), 'src/splash/styles.css'), 'utf8');

        expect(source).not.toContain('body::before');
        expect(source).not.toContain('backdrop-filter');
        expect(source).not.toContain('box-shadow: 0 28px 80px');
        expect(source).not.toContain('rgba(9, 11, 18, 0.88)');
    });

    it('reserves stable layout rows for mascot, text, diagnostics, and progress', () => {
        const source = readFileSync(path.join(process.cwd(), 'src/splash/styles.css'), 'utf8');

        expect(source).toContain('display: flex;');
        expect(source).toContain('flex-direction: column;');
        expect(source).toContain('min-height: min(430px, calc(100vh - 32px));');
        expect(source).toContain('min-height: calc(2 * 1.2em);');
        expect(source).toContain('min-height: calc(2 * 1.55em);');
        expect(source).toContain('height: 6px;');
        expect(source).toContain('margin-top: auto;');
        expect(source).toContain('align-self: end;');
    });
});
