import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { MessageTimelineItem } from '@/web/components/conversation/messages/messageTimeline';

describe('message timeline assistant placeholders', () => {
    it('shows an assistant lifecycle row before output arrives', () => {
        const html = renderToStaticMarkup(
            <MessageTimelineItem
                profileId='profile_default'
                entry={{
                    id: 'msg_assistant',
                    runId: 'run_default',
                    role: 'assistant',
                    createdAt: '2026-03-12T09:00:00.000Z',
                    body: [
                        {
                            id: 'part_status',
                            type: 'assistant_status',
                            code: 'received',
                            label: 'Agent received message',
                        },
                    ],
                }}
                runStatus='running'
                canBranch={false}
            />
        );

        expect(html).toContain('Agent received message');
    });

    it('shows a concrete failure message when a run ends before assistant output arrives', () => {
        const html = renderToStaticMarkup(
            <MessageTimelineItem
                profileId='profile_default'
                entry={{
                    id: 'msg_assistant',
                    runId: 'run_default',
                    role: 'assistant',
                    createdAt: '2026-03-12T09:00:00.000Z',
                    body: [],
                }}
                runStatus='error'
                runErrorMessage='Provider stream dropped.'
                canBranch={false}
            />
        );

        expect(html).toContain('Run failed before any assistant output was recorded.');
        expect(html).toContain('Provider stream dropped.');
    });

    it('shows a sending affordance for optimistic user entries', () => {
        const html = renderToStaticMarkup(
            <MessageTimelineItem
                profileId='profile_default'
                entry={{
                    id: 'msg_user_sending',
                    runId: 'optimistic_run',
                    role: 'user',
                    createdAt: '2026-03-12T09:00:00.000Z',
                    body: [
                        {
                            id: 'part_user_text',
                            type: 'user_text',
                            text: 'Ship it',
                            providerLimitedReasoning: false,
                        },
                    ],
                    plainCopyText: 'Ship it',
                    rawCopyText: 'Ship it',
                    editableText: 'Ship it',
                    deliveryState: 'sending',
                    isOptimistic: true,
                }}
                canBranch={false}
            />
        );

        expect(html).toContain('Ship it');
        expect(html).toContain('Sending...');
    });
});
