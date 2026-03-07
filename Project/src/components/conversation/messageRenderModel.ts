export interface MessageRenderInlineSegment {
    kind: 'text' | 'inline_code';
    text: string;
}

export interface MessageRenderToken {
    kind: 'plain' | 'keyword' | 'string' | 'number' | 'comment' | 'operator';
    text: string;
}

export interface MessageRenderCodeLine {
    lineNumber: number;
    tokens: MessageRenderToken[];
}

export interface MessageRenderParagraphBlock {
    kind: 'paragraph';
    text: string;
    segments: MessageRenderInlineSegment[];
}

export interface MessageRenderCodeBlock {
    kind: 'code';
    code: string;
    language?: string;
    lines: MessageRenderCodeLine[];
}

export type MessageRenderBlock = MessageRenderParagraphBlock | MessageRenderCodeBlock;

const KEYWORDS_BY_LANGUAGE: Record<string, Set<string>> = {
    javascript: new Set([
        'async',
        'await',
        'break',
        'case',
        'catch',
        'class',
        'const',
        'continue',
        'default',
        'delete',
        'else',
        'export',
        'extends',
        'false',
        'finally',
        'for',
        'from',
        'function',
        'if',
        'import',
        'in',
        'let',
        'new',
        'null',
        'return',
        'switch',
        'throw',
        'true',
        'try',
        'typeof',
        'undefined',
        'var',
        'while',
        'yield',
    ]),
    typescript: new Set([
        'as',
        'declare',
        'enum',
        'implements',
        'interface',
        'keyof',
        'namespace',
        'private',
        'protected',
        'public',
        'readonly',
        'satisfies',
        'type',
    ]),
    json: new Set(['false', 'null', 'true']),
    bash: new Set(['case', 'do', 'done', 'elif', 'else', 'esac', 'fi', 'for', 'if', 'in', 'then', 'while']),
    powershell: new Set(['begin', 'class', 'elseif', 'else', 'end', 'foreach', 'function', 'if', 'param', 'process', 'return', 'switch', 'throw', 'trap', 'try', 'while']),
    markdown: new Set([]),
};

const LANGUAGE_ALIASES: Record<string, string> = {
    cjs: 'javascript',
    js: 'javascript',
    jsx: 'javascript',
    jsonc: 'json',
    md: 'markdown',
    ps1: 'powershell',
    psm1: 'powershell',
    sh: 'bash',
    shell: 'bash',
    ts: 'typescript',
    tsx: 'typescript',
};

const OPERATOR_PATTERN = /^(=>|===|!==|==|!=|<=|>=|\+\+|--|&&|\|\||[{}[\]().,:;<>+\-*/=%!?|&])$/;
const NUMBER_PATTERN = /^(0x[\da-f]+|\d+(?:\.\d+)?)$/i;

function normalizeLanguage(value: string | undefined): string | undefined {
    if (!value) {
        return undefined;
    }

    const normalized = value.trim().toLowerCase();
    if (normalized.length === 0) {
        return undefined;
    }

    return LANGUAGE_ALIASES[normalized] ?? normalized;
}

function getKeywordSet(language: string | undefined): Set<string> {
    const javascriptKeywords = KEYWORDS_BY_LANGUAGE['javascript']!;

    if (!language) {
        return javascriptKeywords;
    }

    if (language === 'typescript') {
        return new Set([...javascriptKeywords, ...KEYWORDS_BY_LANGUAGE['typescript']!]);
    }

    return KEYWORDS_BY_LANGUAGE[language] ?? javascriptKeywords;
}

function readCommentStart(line: string, language: string | undefined): number {
    if (language === 'bash' || language === 'powershell') {
        return line.indexOf('#');
    }

    return line.indexOf('//');
}

function tokenizeTextSegment(text: string, keywordSet: Set<string>): MessageRenderToken[] {
    const tokens: MessageRenderToken[] = [];
    const parts = text.split(/(\b|\s+)/);

    for (const part of parts) {
        if (part.length === 0) {
            continue;
        }

        if (NUMBER_PATTERN.test(part)) {
            tokens.push({ kind: 'number', text: part });
            continue;
        }

        if (OPERATOR_PATTERN.test(part)) {
            tokens.push({ kind: 'operator', text: part });
            continue;
        }

        if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(part) && keywordSet.has(part)) {
            tokens.push({ kind: 'keyword', text: part });
            continue;
        }

        tokens.push({ kind: 'plain', text: part });
    }

    return tokens;
}

function tokenizeCodeLine(line: string, language: string | undefined): MessageRenderToken[] {
    const commentStart = readCommentStart(line, language);
    const content = commentStart >= 0 ? line.slice(0, commentStart) : line;
    const comment = commentStart >= 0 ? line.slice(commentStart) : '';
    const keywordSet = getKeywordSet(language);
    const tokens: MessageRenderToken[] = [];
    const pattern = /("(?:\\.|[^"])*"|'(?:\\.|[^'])*'|`(?:\\.|[^`])*`)/g;

    let lastIndex = 0;
    for (const match of content.matchAll(pattern)) {
        const matched = match[0];
        const index = match.index ?? 0;

        if (index > lastIndex) {
            tokens.push(...tokenizeTextSegment(content.slice(lastIndex, index), keywordSet));
        }

        tokens.push({ kind: 'string', text: matched });
        lastIndex = index + matched.length;
    }

    if (lastIndex < content.length) {
        tokens.push(...tokenizeTextSegment(content.slice(lastIndex), keywordSet));
    }

    if (comment.length > 0) {
        tokens.push({ kind: 'comment', text: comment });
    }

    return tokens.length > 0 ? tokens : [{ kind: 'plain', text: '' }];
}

function tokenizeCodeBlock(code: string, language: string | undefined): MessageRenderCodeLine[] {
    return code.split('\n').map((line, index) => ({
        lineNumber: index + 1,
        tokens: tokenizeCodeLine(line, language),
    }));
}

function parseInlineSegments(text: string): MessageRenderInlineSegment[] {
    const segments: MessageRenderInlineSegment[] = [];
    let cursor = 0;

    while (cursor < text.length) {
        const opening = text.indexOf('`', cursor);
        if (opening < 0) {
            segments.push({ kind: 'text', text: text.slice(cursor) });
            break;
        }

        if (opening > cursor) {
            segments.push({ kind: 'text', text: text.slice(cursor, opening) });
        }

        const closing = text.indexOf('`', opening + 1);
        if (closing < 0) {
            segments.push({ kind: 'text', text: text.slice(opening) });
            break;
        }

        const inlineCode = text.slice(opening + 1, closing);
        if (inlineCode.length > 0) {
            segments.push({ kind: 'inline_code', text: inlineCode });
        }
        cursor = closing + 1;
    }

    return segments.filter((segment) => segment.text.length > 0);
}

function buildParagraphBlocks(text: string): MessageRenderParagraphBlock[] {
    return text
        .split(/\n{2,}/)
        .map((paragraph) => paragraph.trim())
        .filter((paragraph) => paragraph.length > 0)
        .map((paragraph) => ({
            kind: 'paragraph' as const,
            text: paragraph,
            segments: parseInlineSegments(paragraph),
        }));
}

export function parseMessageRenderBlocks(text: string): MessageRenderBlock[] {
    const normalized = text.replace(/\r\n?/g, '\n').trim();
    if (normalized.length === 0) {
        return [];
    }

    const blocks: MessageRenderBlock[] = [];
    const lines = normalized.split('\n');
    const pendingText: string[] = [];
    let index = 0;

    function flushPendingText() {
        if (pendingText.length === 0) {
            return;
        }

        blocks.push(...buildParagraphBlocks(pendingText.join('\n')));
        pendingText.length = 0;
    }

    while (index < lines.length) {
        const line = lines[index] ?? '';
        const fenceMatch = line.match(/^```([\w-]+)?\s*$/);
        if (!fenceMatch) {
            pendingText.push(line);
            index += 1;
            continue;
        }

        flushPendingText();
        const language = normalizeLanguage(fenceMatch[1]);
        index += 1;
        const codeLines: string[] = [];

        while (index < lines.length && !/^```\s*$/.test(lines[index] ?? '')) {
            codeLines.push(lines[index] ?? '');
            index += 1;
        }

        blocks.push({
            kind: 'code',
            code: codeLines.join('\n'),
            ...(language ? { language } : {}),
            lines: tokenizeCodeBlock(codeLines.join('\n'), language),
        });

        if (index < lines.length && /^```\s*$/.test(lines[index] ?? '')) {
            index += 1;
        }
    }

    flushPendingText();
    return blocks;
}
