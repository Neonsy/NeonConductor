import { beforeEach, describe, expect, it, vi } from 'vitest';

const { highlightMarkdownCodeMock } = vi.hoisted(() => ({
    highlightMarkdownCodeMock: vi.fn(),
}));

vi.mock('@/web/components/content/markdown/shikiHighlighter', () => ({
    highlightMarkdownCode: highlightMarkdownCodeMock,
}));

import { resolveHighlightedMarkdownCode } from '@/web/components/content/markdown/markdownCodeBlock';

describe('resolveHighlightedMarkdownCode', () => {
    beforeEach(() => {
        highlightMarkdownCodeMock.mockReset();
    });

    it('returns highlighted html when highlighting succeeds', async () => {
        highlightMarkdownCodeMock.mockResolvedValue('<span>code</span>');

        await expect(
            resolveHighlightedMarkdownCode({
                code: 'const value = 1;',
                theme: 'light',
                language: 'ts',
            })
        ).resolves.toBe('<span>code</span>');
    });

    it('fails closed to plain-code fallback when highlighting rejects', async () => {
        highlightMarkdownCodeMock.mockRejectedValue(new Error('shiki unavailable'));

        await expect(
            resolveHighlightedMarkdownCode({
                code: 'const value = 1;',
                theme: 'dark',
                language: 'ts',
            })
        ).resolves.toBeNull();
    });
});
