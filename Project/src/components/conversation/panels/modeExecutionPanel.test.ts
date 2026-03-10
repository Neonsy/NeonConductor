import { describe, expect, it } from 'vitest';

import { resolveModeExecutionDraftState } from '@/web/components/conversation/panels/modeExecutionPanelState';

describe('resolveModeExecutionDraftState', () => {
    it('keeps keyed plan drafts instead of replacing them with refreshed plan data', () => {
        const activePlan = {
            id: 'plan_1',
            status: 'draft',
            summaryMarkdown: 'Server Summary',
            questions: [{ id: 'q_1', question: 'Question?', answer: 'Server Answer' }],
            items: [{ id: 'step_1', sequence: 1, description: 'Server Item', status: 'pending' }],
        } as const;

        expect(
            resolveModeExecutionDraftState({
                activePlan: activePlan as never,
                draftState: {
                    planId: 'plan_1',
                    summaryDraft: 'Unsaved Summary',
                    itemsDraft: 'Unsaved Item',
                    answerByQuestionId: {
                        q_1: 'Unsaved Answer',
                    },
                },
            })
        ).toEqual({
            planId: 'plan_1',
            summaryDraft: 'Unsaved Summary',
            itemsDraft: 'Unsaved Item',
            answerByQuestionId: {
                q_1: 'Unsaved Answer',
            },
        });
    });
});
