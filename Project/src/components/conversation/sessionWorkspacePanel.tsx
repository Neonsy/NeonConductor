import { ComposerActionPanel } from '@/web/components/conversation/panels/composerActionPanel';
import { MessageTimelinePanel } from '@/web/components/conversation/panels/messageTimelinePanel';
import { Button } from '@/web/components/ui/button';

import type {
    MessagePartRecord,
    MessageRecord,
    SessionSummaryRecord,
    RunRecord,
} from '@/app/backend/persistence/types';

import type { ReactNode } from 'react';

interface SessionWorkspacePanelProps {
    sessions: SessionSummaryRecord[];
    runs: RunRecord[];
    messages: MessageRecord[];
    partsByMessageId: Map<string, MessagePartRecord[]>;
    selectedSessionId?: string;
    selectedRunId?: string;
    prompt: string;
    isCreatingSession: boolean;
    isStartingRun: boolean;
    canCreateSession: boolean;
    selectedProviderId: string | undefined;
    selectedModelId: string | undefined;
    routingBadge?: string;
    providerOptions: Array<{ id: string; label: string; authState: string }>;
    modelOptions: Array<{ id: string; label: string; price?: number; latency?: number; tps?: number }>;
    runErrorMessage: string | undefined;
    modePanel?: ReactNode;
    onSelectSession: (sessionId: string) => void;
    onSelectRun: (runId: string) => void;
    onProviderChange: (providerId: string) => void;
    onModelChange: (modelId: string) => void;
    onCreateSession: () => void;
    onPromptChange: (nextPrompt: string) => void;
    onSubmitPrompt: () => void;
}

export function SessionWorkspacePanel({
    sessions,
    runs,
    messages,
    partsByMessageId,
    selectedSessionId,
    selectedRunId,
    prompt,
    isCreatingSession,
    isStartingRun,
    canCreateSession,
    selectedProviderId,
    selectedModelId,
    routingBadge,
    providerOptions,
    modelOptions,
    runErrorMessage,
    modePanel,
    onSelectSession,
    onSelectRun,
    onProviderChange,
    onModelChange,
    onCreateSession,
    onPromptChange,
    onSubmitPrompt,
}: SessionWorkspacePanelProps) {
    return (
        <div className='grid min-h-0 flex-1 grid-cols-[280px_1fr]'>
            <aside className='border-border min-h-0 overflow-y-auto border-r p-3'>
                <div className='mb-2 flex justify-end'>
                    <Button
                        type='button'
                        size='sm'
                        disabled={!canCreateSession || isCreatingSession}
                        onClick={onCreateSession}>
                        New Session
                    </Button>
                </div>

                <div className='space-y-2'>
                    {sessions.map((session) => (
                        <button
                            key={session.id}
                            type='button'
                            className={`w-full rounded-md border p-2 text-left ${
                                selectedSessionId === session.id
                                    ? 'border-primary bg-primary/10'
                                    : 'border-border bg-card hover:bg-accent'
                            }`}
                            onClick={() => {
                                onSelectSession(session.id);
                            }}>
                            <p className='text-sm font-medium'>{session.id}</p>
                            <p className='text-muted-foreground text-xs'>
                                {session.kind} · {session.runStatus} · turns {session.turnCount}
                            </p>
                        </button>
                    ))}
                    {sessions.length === 0 ? (
                        <p className='text-muted-foreground text-sm'>No sessions for this thread yet.</p>
                    ) : null}
                </div>
            </aside>

            <div className='flex min-h-0 flex-col p-4'>
                <div className='mb-3 flex items-center gap-2 overflow-x-auto pb-1'>
                    {runs.map((run) => (
                        <button
                            key={run.id}
                            type='button'
                            className={`rounded-md border px-2 py-1 text-xs ${
                                selectedRunId === run.id
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-border bg-card text-foreground'
                            }`}
                            onClick={() => {
                                onSelectRun(run.id);
                            }}>
                            {run.id} · {run.status}
                        </button>
                    ))}
                </div>

                {modePanel}

                <MessageTimelinePanel messages={messages} partsByMessageId={partsByMessageId} />

                <ComposerActionPanel
                    prompt={prompt}
                    disabled={!selectedSessionId}
                    isSubmitting={isStartingRun}
                    selectedProviderId={selectedProviderId}
                    selectedModelId={selectedModelId}
                    {...(routingBadge !== undefined ? { routingBadge } : {})}
                    providerOptions={providerOptions}
                    modelOptions={modelOptions}
                    runErrorMessage={runErrorMessage}
                    onProviderChange={onProviderChange}
                    onModelChange={onModelChange}
                    onPromptChange={onPromptChange}
                    onSubmitPrompt={onSubmitPrompt}
                />
            </div>
        </div>
    );
}
