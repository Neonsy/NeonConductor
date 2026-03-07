import { describe, expect, it } from 'vitest';

import { parseRichContentBlocks } from '@/web/components/content/richContentModel';

describe('parseRichContentBlocks', () => {
    it('parses headings, paragraphs, lists, and fenced code without executing markup', () => {
        const blocks = parseRichContentBlocks(`# Summary

Paragraph with \`inline\` code and <script>alert(1)</script>.

- First item
- Second item

\`\`\`ts
const value = 1;
\`\`\`
`);

        expect(blocks).toHaveLength(4);
        expect(blocks[0]).toMatchObject({
            kind: 'heading',
            level: 1,
            text: 'Summary',
        });
        expect(blocks[1]).toMatchObject({
            kind: 'paragraph',
            text: 'Paragraph with `inline` code and <script>alert(1)</script>.',
        });
        expect(blocks[2]).toMatchObject({
            kind: 'list',
            items: [{ text: 'First item' }, { text: 'Second item' }],
        });
        expect(blocks[3]).toMatchObject({
            kind: 'code',
            language: 'typescript',
            code: 'const value = 1;',
        });
    });
});
