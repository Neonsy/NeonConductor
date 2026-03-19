import { describe, expect, it } from 'vitest';

import {
    buildBranchSelectionTransition,
    buildEditSelectionTransition,
} from '@/web/components/conversation/shell/editFlowSelection';

describe('edit flow selection transition', () => {
    it('switches the shell to the branched thread and clears the selected run', () => {
        expect(
            buildBranchSelectionTransition({
                currentTopLevelTab: 'chat',
                result: {
                    sessionId: 'sess_branch',
                    threadId: 'thr_branch',
                    topLevelTab: 'agent',
                },
            })
        ).toEqual({
            selectedThreadId: 'thr_branch',
            selectedSessionId: 'sess_branch',
            selectedRunId: undefined,
            nextTopLevelTab: 'agent',
        });
    });

    it('keeps the current tab when an edit result stays in the same top-level area', () => {
        expect(
            buildEditSelectionTransition({
                currentTopLevelTab: 'agent',
                result: {
                    sessionId: 'sess_edit',
                    threadId: 'thr_edit',
                    runId: 'run_edit',
                    topLevelTab: 'agent',
                },
            })
        ).toEqual({
            selectedThreadId: 'thr_edit',
            selectedSessionId: 'sess_edit',
            selectedRunId: 'run_edit',
        });
    });

    it('clears the selected run after an edit result that does not start a replacement run', () => {
        expect(
            buildEditSelectionTransition({
                currentTopLevelTab: 'chat',
                result: {
                    sessionId: 'sess_edit',
                    threadId: 'thr_edit',
                },
            })
        ).toEqual({
            selectedThreadId: 'thr_edit',
            selectedSessionId: 'sess_edit',
            selectedRunId: undefined,
        });
    });
});
