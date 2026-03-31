export interface ToolArtifactLineEntry {
    lineNumber: number;
    text: string;
}

export interface ToolArtifactLineWindow {
    startLine: number;
    lineCount: number;
    lines: ToolArtifactLineEntry[];
    hasPrevious: boolean;
    hasNext: boolean;
}

export interface ToolArtifactSearchMatch {
    lineNumber: number;
    lineText: string;
    matchStart: number;
    matchEnd: number;
}

const MAX_SEARCH_MATCHES = 100;

export function splitToolArtifactLines(rawText: string): string[] {
    if (rawText.length === 0) {
        return [];
    }

    return rawText.split(/\r\n|\r|\n/u);
}

export function buildToolArtifactLineWindow(input: {
    rawText: string;
    startLine?: number;
    lineCount?: number;
}): ToolArtifactLineWindow {
    const allLines = splitToolArtifactLines(input.rawText);
    const requestedLineCount = Math.max(1, Math.min(Math.floor(input.lineCount ?? 400), 400));
    const startLine =
        allLines.length === 0 ? 1 : Math.max(1, Math.min(Math.floor(input.startLine ?? 1), allLines.length));
    const startIndex = startLine - 1;
    const selectedLines = allLines.slice(startIndex, startIndex + requestedLineCount);

    return {
        startLine,
        lineCount: requestedLineCount,
        lines: selectedLines.map((text, index) => ({
            lineNumber: startLine + index,
            text,
        })),
        hasPrevious: startLine > 1,
        hasNext: startIndex + selectedLines.length < allLines.length,
    };
}

export function searchToolArtifactText(input: {
    rawText: string;
    query: string;
    caseSensitive?: boolean;
}): { matches: ToolArtifactSearchMatch[]; truncated: boolean } {
    const matches: ToolArtifactSearchMatch[] = [];
    if (input.query.length === 0) {
        return {
            matches,
            truncated: false,
        };
    }

    const normalizedQuery = input.caseSensitive ? input.query : input.query.toLocaleLowerCase();
    const lines = splitToolArtifactLines(input.rawText);

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        const lineText = lines[lineIndex] ?? '';
        const searchText = input.caseSensitive ? lineText : lineText.toLocaleLowerCase();
        let searchOffset = 0;

        while (searchOffset <= searchText.length) {
            const matchStart = searchText.indexOf(normalizedQuery, searchOffset);
            if (matchStart < 0) {
                break;
            }

            matches.push({
                lineNumber: lineIndex + 1,
                lineText,
                matchStart,
                matchEnd: matchStart + normalizedQuery.length,
            });
            if (matches.length >= MAX_SEARCH_MATCHES) {
                return {
                    matches,
                    truncated: true,
                };
            }

            searchOffset = matchStart + Math.max(1, normalizedQuery.length);
        }
    }

    return {
        matches,
        truncated: false,
    };
}
