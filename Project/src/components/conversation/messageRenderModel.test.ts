import { describe, expect, it } from 'vitest';

import { parseRichContentBlocks } from '@/web/components/content/richContentModel';

describe('rich content model', () => {
    it('splits fenced code blocks from paragraphs and preserves inline code', () => {
        const blocks = parseRichContentBlocks([
            'Intro paragraph with `inline` detail.',
            '',
            '```ts',
            'const answer = 42;',
            '```',
            '',
            'Closing paragraph.',
        ].join('\n'));

        expect(blocks).toHaveLength(3);
        expect(blocks[0]).toMatchObject({
            kind: 'paragraph',
            segments: [
                { kind: 'text', text: 'Intro paragraph with ' },
                { kind: 'inline_code', text: 'inline' },
                { kind: 'text', text: ' detail.' },
            ],
        });
        expect(blocks[1]).toMatchObject({
            kind: 'code',
            language: 'typescript',
        });
        expect(blocks[2]).toMatchObject({
            kind: 'paragraph',
            text: 'Closing paragraph.',
        });
    });

    it('highlights basic token kinds inside code blocks', () => {
        const [block] = parseRichContentBlocks(['```js', 'const total = 7 // count', '```'].join('\n'));
        if (!block || block.kind !== 'code') {
            throw new Error('Expected a code block.');
        }

        expect(block.lines[0]?.tokens.some((token) => token.kind === 'keyword' && token.text === 'const')).toBe(true);
        expect(block.lines[0]?.tokens.some((token) => token.kind === 'number' && token.text === '7')).toBe(true);
        expect(block.lines[0]?.tokens.some((token) => token.kind === 'comment')).toBe(true);
    });
});
