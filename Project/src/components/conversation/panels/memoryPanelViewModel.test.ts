import { describe, expect, it } from 'vitest';

import { buildMemoryPanelViewModel } from '@/web/components/conversation/panels/memoryPanelViewModel';

describe('buildMemoryPanelViewModel', () => {
    it('describes canonical vs projected memory clearly', () => {
        const viewModel = buildMemoryPanelViewModel({
            topLevelTab: 'agent',
            modeKey: 'code',
            includeBroaderScopes: true,
            projectionStatusIsFetching: false,
            scanProjectionEditsIsFetching: false,
            projectionStatus: {
                paths: {
                    globalMemoryRoot: 'C:/memory/global',
                    workspaceMemoryRoot: 'C:/workspace/.neonconductor/memory',
                },
                projectedMemories: [],
            },
            scanProjectionEdits: {
                paths: {
                    globalMemoryRoot: 'C:/memory/global',
                    workspaceMemoryRoot: 'C:/workspace/.neonconductor/memory',
                },
                proposals: [],
                parseErrors: [],
            },
        });

        expect(viewModel.canonicalMemoryNote).toContain('Canonical memory is the backend source of truth.');
        expect(viewModel.canonicalMemoryNote).toContain('Projected files are review-only until applied.');
        expect(viewModel.contextLabel).toBe('agent.code');
    });
});
