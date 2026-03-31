import { describe, expect, it } from 'vitest';

import {
    buildToolArtifactLineWindow,
    searchToolArtifactText,
    splitToolArtifactLines,
} from '@/app/backend/persistence/stores/conversation/messages/toolResultArtifactText';

describe('toolResultArtifactText', () => {
    it('splits mixed newline styles into normalized lines', () => {
        expect(splitToolArtifactLines('alpha\r\nbeta\rgamma\ndelta')).toEqual(['alpha', 'beta', 'gamma', 'delta']);
    });

    it('builds a bounded line window with navigation flags', () => {
        const rawText = Array.from({ length: 6 }, (_, index) => `line-${String(index + 1)}`).join('\n');

        expect(buildToolArtifactLineWindow({ rawText, startLine: 3, lineCount: 2 })).toEqual({
            startLine: 3,
            lineCount: 2,
            lines: [
                { lineNumber: 3, text: 'line-3' },
                { lineNumber: 4, text: 'line-4' },
            ],
            hasPrevious: true,
            hasNext: true,
        });
    });

    it('searches text artifacts with bounded substring matches', () => {
        const rawText = Array.from({ length: 120 }, (_, index) =>
            index % 2 === 0 ? `match-${String(index)} alpha` : `miss-${String(index)}`
        ).join('\n');

        const result = searchToolArtifactText({
            rawText,
            query: 'match',
        });

        expect(result.matches).toHaveLength(60);
        expect(result.matches[0]).toMatchObject({
            lineNumber: 1,
            lineText: 'match-0 alpha',
            matchStart: 0,
            matchEnd: 5,
        });
        expect(result.truncated).toBe(false);
    });
});
