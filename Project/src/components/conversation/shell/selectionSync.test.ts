import { describe, expect, it } from 'vitest';

import { buildConversationSelectionSyncPatch } from '@/web/components/conversation/shell/selectionSync';

describe('conversation selection sync patch', () => {
    it('repairs stale persisted session and run selection using the resolved shell selection', () => {
        const patch = buildConversationSelectionSyncPatch({
            selection: {
                resolvedSessionId: 'sess_current',
                resolvedRunId: 'run_current',
                shouldUpdateSessionSelection: true,
                shouldUpdateRunSelection: true,
            },
        });

        expect(patch).toEqual({
            selectedSessionId: 'sess_current',
            selectedRunId: 'run_current',
        });
    });

    it('returns no patch when the persisted selection is already valid', () => {
        const patch = buildConversationSelectionSyncPatch({
            selection: {
                resolvedSessionId: 'sess_current',
                resolvedRunId: 'run_current',
                shouldUpdateSessionSelection: false,
                shouldUpdateRunSelection: false,
            },
        });

        expect(patch).toBeUndefined();
    });
});
