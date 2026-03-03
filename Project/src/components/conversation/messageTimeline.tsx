import { projectConversationParts } from '@/web/lib/runtime/reasoningProjection';

import type { MessagePartRecord, MessageRecord } from '@/app/backend/persistence/types';

interface MessageTimelineProps {
    messages: MessageRecord[];
    partsByMessageId: Map<string, MessagePartRecord[]>;
}

function readTextPart(part: MessagePartRecord): string | null {
    const text = part.payload['text'];
    if (typeof text !== 'string') {
        return null;
    }

    const normalized = text.trim();
    return normalized.length > 0 ? normalized : null;
}

export function MessageTimeline({ messages, partsByMessageId }: MessageTimelineProps) {
    if (messages.length === 0) {
        return (
            <div className='text-muted-foreground border-border bg-card/60 rounded-lg border p-4 text-sm'>
                No messages yet for this session.
            </div>
        );
    }

    return (
        <div className='space-y-3'>
            {messages.map((message) => {
                const parts = partsByMessageId.get(message.id) ?? [];

                const body =
                    message.role === 'assistant'
                        ? projectConversationParts(parts).map((item) => ({
                              id: item.id,
                              type: item.role,
                              text: item.text,
                              providerLimitedReasoning: item.providerLimitedReasoning,
                          }))
                        : (() => {
                              const projected: Array<{
                                  id: string;
                                  type: 'user_text' | 'assistant_text';
                                  text: string;
                                  providerLimitedReasoning: false;
                              }> = [];

                              for (const part of parts) {
                                  const text = readTextPart(part);
                                  if (!text) {
                                      continue;
                                  }

                                  projected.push({
                                      id: part.id,
                                      type: message.role === 'user' ? 'user_text' : 'assistant_text',
                                      text,
                                      providerLimitedReasoning: false,
                                  });
                              }

                              return projected;
                          })();

                return (
                    <article key={message.id} className='border-border bg-card rounded-lg border p-3'>
                        <header className='mb-2 flex items-center gap-2'>
                            <span className='bg-secondary text-secondary-foreground rounded px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase'>
                                {message.role}
                            </span>
                            <span className='text-muted-foreground text-xs'>
                                {new Date(message.createdAt).toLocaleTimeString()}
                            </span>
                        </header>
                        <div className='space-y-2 text-sm leading-relaxed'>
                            {body.length > 0 ? (
                                body.map((item) => (
                                    <div key={item.id} className='space-y-1'>
                                        {item.type === 'assistant_reasoning' ? (
                                            <div className='text-primary inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase'>
                                                Reasoning
                                                {item.providerLimitedReasoning ? (
                                                    <span className='text-muted-foreground text-[10px] tracking-normal lowercase'>
                                                        provider-limited
                                                    </span>
                                                ) : null}
                                            </div>
                                        ) : null}
                                        <p className='whitespace-pre-wrap'>{item.text}</p>
                                    </div>
                                ))
                            ) : (
                                <p className='text-muted-foreground'>No renderable text payload.</p>
                            )}
                        </div>
                    </article>
                );
            })}
        </div>
    );
}
