import { describe, expect, it } from 'vitest';

import {
    getCenteredToolArtifactStartLine,
    getNextToolArtifactStartLine,
    getPreviousToolArtifactStartLine,
    TOOL_ARTIFACT_VIEWER_PAGE_LINE_COUNT,
} from '@/web/components/conversation/shell/useToolArtifactViewerController';

describe('useToolArtifactViewerController helpers', () => {
    it('centers search jumps around the selected line while clamping to line 1', () => {
        expect(getCenteredToolArtifactStartLine(10)).toBe(1);
        expect(getCenteredToolArtifactStartLine(321)).toBe(121);
    });

    it('advances and rewinds page windows using the current page size', () => {
        expect(getPreviousToolArtifactStartLine(1, TOOL_ARTIFACT_VIEWER_PAGE_LINE_COUNT)).toBe(1);
        expect(getPreviousToolArtifactStartLine(401, TOOL_ARTIFACT_VIEWER_PAGE_LINE_COUNT)).toBe(1);
        expect(getNextToolArtifactStartLine(1, TOOL_ARTIFACT_VIEWER_PAGE_LINE_COUNT)).toBe(401);
        expect(getNextToolArtifactStartLine(201, 100)).toBe(301);
    });
});
