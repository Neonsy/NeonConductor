import { useEffect, useMemo, useState } from 'react';

import { MessageTimeline } from '@/web/components/conversation/messageTimeline';
import { ConversationSidebar } from '@/web/components/conversation/sidebar';
import { Button } from '@/web/components/ui/button';
import { useRuntimeEventStreamStore } from '@/web/lib/runtime/eventStream';
import { DEFAULT_PROFILE_ID } from '@/web/lib/runtime/profile';
import { useRuntimeSnapshot } from '@/web/lib/runtime/useRuntimeSnapshot';
import { trpc } from '@/web/trpc/client';

import type { MessagePartRecord } from '@/app/backend/persistence/types';
import type { EntityId, EntityIdPrefix, RuntimeRunOptions } from '@/app/backend/runtime/contracts';

const DEFAULT_RUN_OPTIONS: RuntimeRunOptions = {
    reasoning: {
        effort: 'medium',
        summary: 'auto',
        includeEncrypted: false,
    },
    cache: {
        strategy: 'auto',
    },
    transport: {
        openai: 'auto',
    },
};

type ScopeFilter = 'all' | 'workspace' | 'detached';
type ThreadSort = 'latest' | 'alphabetical';

function isEntityId<P extends EntityIdPrefix>(value: string | undefined, prefix: P): value is EntityId<P> {
    return typeof value === 'string' && value.startsWith(`${prefix}_`) && value.length > prefix.length + 1;
}

export function ConversationShell() {
    const profileId = DEFAULT_PROFILE_ID;
    const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all');
    const [workspaceFilter, setWorkspaceFilter] = useState<string>();
    const [sort, setSort] = useState<ThreadSort | null>(null);
    const [selectedThreadId, setSelectedThreadId] = useState<string>();
    const [selectedSessionId, setSelectedSessionId] = useState<string>();
    const [selectedRunId, setSelectedRunId] = useState<string>();
    const [selectedTagId, setSelectedTagId] = useState<string>();
    const [prompt, setPrompt] = useState('');

    const runtimeSnapshot = useRuntimeSnapshot(profileId);
    const listBucketsQuery = trpc.conversation.listBuckets.useQuery({ profileId }, { refetchOnWindowFocus: false });
    const listTagsQuery = trpc.conversation.listTags.useQuery({ profileId }, { refetchOnWindowFocus: false });
    const listThreadsQuery = trpc.conversation.listThreads.useQuery(
        {
            profileId,
            ...(scopeFilter !== 'all' ? { scope: scopeFilter } : {}),
            ...(workspaceFilter ? { workspaceFingerprint: workspaceFilter } : {}),
            ...(sort ? { sort } : {}),
        },
        { refetchOnWindowFocus: false }
    );

    const createThreadMutation = trpc.conversation.createThread.useMutation();
    const upsertTagMutation = trpc.conversation.upsertTag.useMutation();
    const setThreadTagsMutation = trpc.conversation.setThreadTags.useMutation();
    const createSessionMutation = trpc.session.create.useMutation();
    const startRunMutation = trpc.session.startRun.useMutation();

    useEffect(() => {
        if (sort || !listThreadsQuery.data?.sort) {
            return;
        }

        setSort(listThreadsQuery.data.sort);
    }, [sort, listThreadsQuery.data?.sort]);

    const lastSequence = useRuntimeEventStreamStore((state) => state.lastSequence);
    const streamState = useRuntimeEventStreamStore((state) => state.connectionState);

    useEffect(() => {
        if (lastSequence <= 0) {
            return;
        }

        const timer = window.setTimeout(() => {
            void listBucketsQuery.refetch();
            void listTagsQuery.refetch();
            void listThreadsQuery.refetch();
        }, 120);

        return () => {
            window.clearTimeout(timer);
        };
    }, [lastSequence, listBucketsQuery, listTagsQuery, listThreadsQuery]);

    const threadTagIdsByThread = useMemo(() => {
        const map = new Map<string, string[]>();
        for (const relation of runtimeSnapshot.data?.threadTags ?? []) {
            const existing = map.get(relation.threadId) ?? [];
            existing.push(relation.tagId);
            map.set(relation.threadId, existing);
        }

        return map;
    }, [runtimeSnapshot.data?.threadTags]);

    const threads = useMemo(() => {
        const all = listThreadsQuery.data?.threads ?? [];
        if (!selectedTagId) {
            return all;
        }

        return all.filter((thread) => (threadTagIdsByThread.get(thread.id) ?? []).includes(selectedTagId));
    }, [listThreadsQuery.data?.threads, selectedTagId, threadTagIdsByThread]);

    useEffect(() => {
        if (threads.length === 0) {
            setSelectedThreadId(undefined);
            return;
        }

        if (selectedThreadId && threads.some((thread) => thread.id === selectedThreadId)) {
            return;
        }

        setSelectedThreadId(threads.at(0)?.id);
    }, [selectedThreadId, threads]);

    const sessions = useMemo(() => {
        if (!selectedThreadId) {
            return [];
        }

        return (runtimeSnapshot.data?.sessions ?? [])
            .filter((session) => session.threadId === selectedThreadId)
            .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    }, [runtimeSnapshot.data?.sessions, selectedThreadId]);

    useEffect(() => {
        if (sessions.length === 0) {
            setSelectedSessionId(undefined);
            return;
        }

        if (selectedSessionId && sessions.some((session) => session.id === selectedSessionId)) {
            return;
        }

        setSelectedSessionId(sessions.at(0)?.id);
    }, [selectedSessionId, sessions]);

    const runs = useMemo(() => {
        if (!selectedSessionId) {
            return [];
        }

        return (runtimeSnapshot.data?.runs ?? [])
            .filter((run) => run.sessionId === selectedSessionId)
            .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    }, [runtimeSnapshot.data?.runs, selectedSessionId]);

    useEffect(() => {
        if (runs.length === 0) {
            setSelectedRunId(undefined);
            return;
        }

        if (selectedRunId && runs.some((run) => run.id === selectedRunId)) {
            return;
        }

        setSelectedRunId(runs.at(0)?.id);
    }, [selectedRunId, runs]);

    const messages = useMemo(() => {
        if (!selectedSessionId) {
            return [];
        }

        return (runtimeSnapshot.data?.messages ?? [])
            .filter((message) => message.sessionId === selectedSessionId)
            .filter((message) => (selectedRunId ? message.runId === selectedRunId : true))
            .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    }, [runtimeSnapshot.data?.messages, selectedRunId, selectedSessionId]);

    const partsByMessageId = useMemo(() => {
        const map = new Map<string, MessagePartRecord[]>();
        const selectedMessageIds = new Set(messages.map((message) => message.id));

        for (const part of runtimeSnapshot.data?.messageParts ?? []) {
            if (!selectedMessageIds.has(part.messageId)) {
                continue;
            }

            const existing = map.get(part.messageId) ?? [];
            existing.push(part);
            map.set(part.messageId, existing);
        }

        for (const [messageId, parts] of map.entries()) {
            parts.sort((left, right) => left.sequence - right.sequence);
            map.set(messageId, parts);
        }

        return map;
    }, [messages, runtimeSnapshot.data?.messageParts]);

    const selectedThread = selectedThreadId ? threads.find((thread) => thread.id === selectedThreadId) : undefined;

    return (
        <main className='bg-background flex min-h-0 flex-1 overflow-hidden'>
            <ConversationSidebar
                buckets={listBucketsQuery.data?.buckets ?? []}
                threads={threads}
                tags={listTagsQuery.data?.tags ?? []}
                threadTagIdsByThread={threadTagIdsByThread}
                {...(selectedThreadId ? { selectedThreadId } : {})}
                {...(selectedTagId ? { selectedTagId } : {})}
                scopeFilter={scopeFilter}
                {...(workspaceFilter ? { workspaceFilter } : {})}
                sort={sort ?? 'latest'}
                isCreatingThread={createThreadMutation.isPending}
                isAddingTag={upsertTagMutation.isPending || setThreadTagsMutation.isPending}
                onSelectThread={(threadId) => {
                    setSelectedThreadId(threadId);
                }}
                onToggleTagFilter={(tagId) => {
                    setSelectedTagId((current) => (current === tagId ? undefined : tagId));
                }}
                onScopeFilterChange={(nextScope) => {
                    setScopeFilter(nextScope);
                    if (nextScope !== 'workspace') {
                        setWorkspaceFilter(undefined);
                    }
                }}
                onWorkspaceFilterChange={setWorkspaceFilter}
                onSortChange={(nextSort) => {
                    setSort(nextSort);
                }}
                onCreateThread={async (input) => {
                    const result = await createThreadMutation.mutateAsync({
                        profileId,
                        ...input,
                    });
                    setSelectedThreadId(result.thread.id);
                    void listBucketsQuery.refetch();
                    void listThreadsQuery.refetch();
                    void runtimeSnapshot.refetch();
                }}
                onAddTagToThread={async (threadId, label) => {
                    if (!isEntityId(threadId, 'thr')) {
                        return;
                    }

                    const upserted = await upsertTagMutation.mutateAsync({
                        profileId,
                        label,
                    });
                    const existing = threadTagIdsByThread.get(threadId) ?? [];
                    const nextTagIds = [...new Set([...existing, upserted.tag.id])];
                    const validTagIds = nextTagIds.filter((tagId): tagId is EntityId<'tag'> =>
                        isEntityId(tagId, 'tag')
                    );
                    if (validTagIds.length !== nextTagIds.length) {
                        return;
                    }

                    await setThreadTagsMutation.mutateAsync({
                        profileId,
                        threadId,
                        tagIds: validTagIds,
                    });
                    void listTagsQuery.refetch();
                    void runtimeSnapshot.refetch();
                }}
            />

            <section className='flex min-h-0 flex-1 flex-col'>
                <header className='border-border flex items-center justify-between border-b px-4 py-3'>
                    <div className='min-w-0'>
                        <p className='truncate text-sm font-semibold'>
                            {selectedThread?.title ?? 'No Thread Selected'}
                        </p>
                        <p className='text-muted-foreground text-xs'>
                            Stream: {streamState} · Events: {runtimeSnapshot.data?.lastSequence ?? 0}
                        </p>
                    </div>
                    <Button
                        type='button'
                        size='sm'
                        disabled={!selectedThreadId || createSessionMutation.isPending}
                        onClick={() => {
                            if (!isEntityId(selectedThreadId, 'thr')) {
                                return;
                            }

                            void createSessionMutation
                                .mutateAsync({
                                    profileId,
                                    threadId: selectedThreadId,
                                    kind: 'local',
                                })
                                .then((result) => {
                                    setSelectedSessionId(result.session.id);
                                    void runtimeSnapshot.refetch();
                                });
                        }}>
                        New Session
                    </Button>
                </header>

                <div className='grid min-h-0 flex-1 grid-cols-[280px_1fr]'>
                    <aside className='border-border min-h-0 overflow-y-auto border-r p-3'>
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
                                        setSelectedSessionId(session.id);
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
                                        setSelectedRunId(run.id);
                                    }}>
                                    {run.id} · {run.status}
                                </button>
                            ))}
                        </div>

                        <div className='min-h-0 flex-1 overflow-y-auto pr-1'>
                            <MessageTimeline messages={messages} partsByMessageId={partsByMessageId} />
                        </div>

                        <form
                            className='border-border mt-3 space-y-2 border-t pt-3'
                            onSubmit={(event) => {
                                event.preventDefault();
                                if (prompt.trim().length === 0 || startRunMutation.isPending) {
                                    return;
                                }

                                if (!isEntityId(selectedSessionId, 'sess')) {
                                    return;
                                }

                                const defaultProviderId = runtimeSnapshot.data?.defaults.providerId;
                                const providerId =
                                    defaultProviderId === 'kilo' || defaultProviderId === 'openai'
                                        ? defaultProviderId
                                        : undefined;

                                void startRunMutation
                                    .mutateAsync({
                                        profileId,
                                        sessionId: selectedSessionId,
                                        prompt: prompt.trim(),
                                        runtimeOptions: DEFAULT_RUN_OPTIONS,
                                        ...(providerId ? { providerId } : {}),
                                        ...(runtimeSnapshot.data?.defaults.modelId
                                            ? { modelId: runtimeSnapshot.data.defaults.modelId }
                                            : {}),
                                    })
                                    .then(() => {
                                        setPrompt('');
                                        void runtimeSnapshot.refetch();
                                    });
                            }}>
                            <textarea
                                value={prompt}
                                onChange={(event) => {
                                    setPrompt(event.target.value);
                                }}
                                rows={3}
                                className='border-border bg-background w-full resize-y rounded-md border p-2 text-sm'
                                placeholder='Prompt for selected session...'
                            />
                            <div className='flex justify-end'>
                                <Button
                                    type='submit'
                                    size='sm'
                                    disabled={
                                        !selectedSessionId || startRunMutation.isPending || prompt.trim().length === 0
                                    }>
                                    Start Run
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            </section>
        </main>
    );
}
