import { describe, expect, it } from 'vitest';

import { analyzeSourceText, shouldSkipFile } from '@/scripts/quality-report';

describe('quality report analyzer', () => {
    it('does not count SQL alias strings as casts', () => {
        const source = `
            const query = db.selectFrom('threads').select(['threads.id as id']);
        `;

        const analyzed = analyzeSourceText(source, 'electron/backend/persistence/stores/threadStore.ts');
        expect(analyzed.castHits).toBe(0);
        expect(analyzed.broadCastHits).toBe(0);
    });

    it('tracks as const separately from broad casts', () => {
        const source = `
            const config = { mode: 'chat' } as const;
        `;

        const analyzed = analyzeSourceText(source, 'src/config.ts');
        expect(analyzed.castHits).toBe(1);
        expect(analyzed.asConstHits).toBe(1);
        expect(analyzed.broadCastHits).toBe(0);
    });

    it('counts broad casts for typed assertions', () => {
        const source = `
            const value = input as SomeType;
        `;

        const analyzed = analyzeSourceText(source, 'src/file.ts');
        expect(analyzed.castHits).toBe(1);
        expect(analyzed.asConstHits).toBe(0);
        expect(analyzed.broadCastHits).toBe(1);
    });

    it('excludes generated files from scanning', () => {
        expect(shouldSkipFile('src/routeTree.gen.ts')).toBe(true);
        expect(shouldSkipFile('src/foo/bar.generated.gen.ts')).toBe(true);
        expect(shouldSkipFile('src/app.ts')).toBe(false);
    });
});
