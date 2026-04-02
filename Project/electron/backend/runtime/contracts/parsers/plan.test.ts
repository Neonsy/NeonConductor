import { describe, expect, it } from 'vitest';

import { parsePlanReviseInput, parsePlanStartInput } from '@/app/backend/runtime/contracts/parsers/plan';

describe('plan parsers', () => {
    it('parses planning depth on plan start input', () => {
        expect(
            parsePlanStartInput({
                profileId: 'profile_default',
                sessionId: 'sess_1',
                topLevelTab: 'agent',
                modeKey: 'plan',
                prompt: 'Draft an advanced plan',
                planningDepth: 'advanced',
            })
        ).toMatchObject({
            profileId: 'profile_default',
            sessionId: 'sess_1',
            topLevelTab: 'agent',
            modeKey: 'plan',
            prompt: 'Draft an advanced plan',
            planningDepth: 'advanced',
        });
    });

    it('parses an advanced snapshot on revise input', () => {
        expect(
            parsePlanReviseInput({
                profileId: 'profile_default',
                planId: 'plan_1',
                summaryMarkdown: '# Revised plan',
                items: [
                    {
                        description: 'Inspect the current plan surface.',
                    },
                ],
                advancedSnapshot: {
                    evidenceMarkdown: 'evidence',
                    observationsMarkdown: 'observations',
                    rootCauseMarkdown: 'root cause',
                    phases: [
                        {
                            id: 'phase_1',
                            sequence: 1,
                            title: 'Scope and evidence',
                            goalMarkdown: 'goal',
                            exitCriteriaMarkdown: 'exit',
                        },
                    ],
                },
            })
        ).toMatchObject({
            profileId: 'profile_default',
            planId: 'plan_1',
            summaryMarkdown: '# Revised plan',
            items: [{ description: 'Inspect the current plan surface.' }],
            advancedSnapshot: expect.objectContaining({
                evidenceMarkdown: 'evidence',
                phases: expect.arrayContaining([
                    expect.objectContaining({
                        id: 'phase_1',
                        sequence: 1,
                    }),
                ]),
            }),
        });
    });
});
