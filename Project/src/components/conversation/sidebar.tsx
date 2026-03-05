import { useState } from 'react';

import { Button } from '@/web/components/ui/button';

import type { ConversationRecord, TagRecord, ThreadListRecord } from '@/app/backend/persistence/types';

interface CreateThreadInput {
    scope: 'detached' | 'workspace';
    workspaceFingerprint?: string;
    title: string;
}

interface ConversationSidebarProps {
    buckets: ConversationRecord[];
    threads: ThreadListRecord[];
    tags: TagRecord[];
    threadTagIdsByThread: Map<string, string[]>;
    selectedThreadId?: string;
    selectedTagId?: string;
    scopeFilter: 'all' | 'workspace' | 'detached';
    workspaceFilter?: string;
    sort: 'latest' | 'alphabetical';
    isCreatingThread: boolean;
    isAddingTag: boolean;
    onSelectThread: (threadId: string) => void;
    onToggleTagFilter: (tagId: string) => void;
    onScopeFilterChange: (scope: 'all' | 'workspace' | 'detached') => void;
    onWorkspaceFilterChange: (workspaceFingerprint?: string) => void;
    onSortChange: (sort: 'latest' | 'alphabetical') => void;
    onCreateThread: (input: CreateThreadInput) => Promise<void>;
    onAddTagToThread: (threadId: string, label: string) => Promise<void>;
}

export function ConversationSidebar({
    buckets,
    threads,
    tags,
    threadTagIdsByThread,
    selectedThreadId,
    selectedTagId,
    scopeFilter,
    workspaceFilter,
    sort,
    isCreatingThread,
    isAddingTag,
    onSelectThread,
    onToggleTagFilter,
    onScopeFilterChange,
    onWorkspaceFilterChange,
    onSortChange,
    onCreateThread,
    onAddTagToThread,
}: ConversationSidebarProps) {
    const [newThreadTitle, setNewThreadTitle] = useState('');
    const [newThreadScope, setNewThreadScope] = useState<'detached' | 'workspace'>('detached');
    const [newThreadWorkspace, setNewThreadWorkspace] = useState('');
    const [newTagLabel, setNewTagLabel] = useState('');

    const workspaceOptions = [
        ...new Set(
            buckets.filter((bucket) => bucket.scope === 'workspace').map((bucket) => bucket.workspaceFingerprint)
        ),
    ]
        .filter((fingerprint): fingerprint is string => Boolean(fingerprint))
        .sort((left, right) => left.localeCompare(right));

    const tagLabelById = new Map(tags.map((tag) => [tag.id, tag.label]));

    const selectedThread = selectedThreadId ? threads.find((thread) => thread.id === selectedThreadId) : undefined;

    return (
        <aside className='border-border bg-card/40 flex min-h-0 w-[320px] flex-col border-r'>
            <div className='border-border space-y-3 border-b p-3'>
                <div className='grid grid-cols-2 gap-2'>
                    <Button
                        type='button'
                        size='sm'
                        variant={scopeFilter === 'all' ? 'secondary' : 'outline'}
                        onClick={() => {
                            onScopeFilterChange('all');
                        }}>
                        All
                    </Button>
                    <Button
                        type='button'
                        size='sm'
                        variant={scopeFilter === 'workspace' ? 'secondary' : 'outline'}
                        onClick={() => {
                            onScopeFilterChange('workspace');
                        }}>
                        Workspace
                    </Button>
                    <Button
                        type='button'
                        size='sm'
                        variant={scopeFilter === 'detached' ? 'secondary' : 'outline'}
                        onClick={() => {
                            onScopeFilterChange('detached');
                        }}>
                        Detached
                    </Button>
                    <select
                        className='border-border bg-background h-9 rounded-md border px-2 text-sm'
                        value={sort}
                        onChange={(event) => {
                            onSortChange(event.target.value === 'alphabetical' ? 'alphabetical' : 'latest');
                        }}>
                        <option value='latest'>Latest</option>
                        <option value='alphabetical'>Alphabetical</option>
                    </select>
                </div>

                {scopeFilter === 'workspace' || workspaceFilter ? (
                    <select
                        className='border-border bg-background h-9 w-full rounded-md border px-2 text-sm'
                        value={workspaceFilter ?? ''}
                        onChange={(event) => {
                            onWorkspaceFilterChange(event.target.value || undefined);
                        }}>
                        <option value=''>All workspaces</option>
                        {workspaceOptions.map((workspace) => (
                            <option key={workspace} value={workspace}>
                                {workspace}
                            </option>
                        ))}
                    </select>
                ) : null}

                <div className='space-y-2'>
                    <input
                        value={newThreadTitle}
                        onChange={(event) => {
                            setNewThreadTitle(event.target.value);
                        }}
                        className='border-border bg-background h-9 w-full rounded-md border px-2 text-sm'
                        placeholder='New thread title'
                    />
                    <div className='grid grid-cols-2 gap-2'>
                        <select
                            className='border-border bg-background h-9 rounded-md border px-2 text-sm'
                            value={newThreadScope}
                            onChange={(event) => {
                                setNewThreadScope(event.target.value === 'workspace' ? 'workspace' : 'detached');
                            }}>
                            <option value='detached'>Detached</option>
                            <option value='workspace'>Workspace</option>
                        </select>
                        <Button
                            type='button'
                            size='sm'
                            disabled={isCreatingThread}
                            onClick={() => {
                                const title = newThreadTitle.trim();
                                if (title.length === 0) {
                                    return;
                                }
                                if (newThreadScope === 'workspace' && newThreadWorkspace.trim().length === 0) {
                                    return;
                                }

                                void onCreateThread({
                                    scope: newThreadScope,
                                    title,
                                    ...(newThreadScope === 'workspace' && newThreadWorkspace.trim().length > 0
                                        ? { workspaceFingerprint: newThreadWorkspace.trim() }
                                        : {}),
                                }).then(() => {
                                    setNewThreadTitle('');
                                });
                            }}>
                            New Thread
                        </Button>
                    </div>
                    {newThreadScope === 'workspace' ? (
                        <input
                            value={newThreadWorkspace}
                            onChange={(event) => {
                                setNewThreadWorkspace(event.target.value);
                            }}
                            className='border-border bg-background h-9 w-full rounded-md border px-2 text-sm'
                            placeholder='workspace fingerprint'
                        />
                    ) : null}
                </div>
            </div>

            <div className='border-border space-y-2 border-b p-3'>
                <p className='text-muted-foreground text-xs font-semibold tracking-wide uppercase'>Tag Filter</p>
                <div className='flex flex-wrap gap-1.5'>
                    {tags.map((tag) => (
                        <button
                            key={tag.id}
                            type='button'
                            className={`rounded-md border px-2 py-1 text-xs ${
                                selectedTagId === tag.id
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'border-border bg-background text-foreground'
                            }`}
                            onClick={() => {
                                onToggleTagFilter(tag.id);
                            }}>
                            {tag.label}
                        </button>
                    ))}
                </div>
                {selectedThread ? (
                    <div className='flex items-center gap-2'>
                        <input
                            value={newTagLabel}
                            onChange={(event) => {
                                setNewTagLabel(event.target.value);
                            }}
                            className='border-border bg-background h-8 min-w-0 flex-1 rounded-md border px-2 text-xs'
                            placeholder='Add tag to selected thread'
                        />
                        <Button
                            type='button'
                            size='sm'
                            variant='outline'
                            disabled={isAddingTag}
                            onClick={() => {
                                const label = newTagLabel.trim();
                                if (label.length === 0) {
                                    return;
                                }

                                void onAddTagToThread(selectedThread.id, label).then(() => {
                                    setNewTagLabel('');
                                });
                            }}>
                            Add
                        </Button>
                    </div>
                ) : null}
            </div>

            <div className='min-h-0 flex-1 overflow-y-auto p-2'>
                <div className='space-y-1'>
                    {threads.map((thread) => {
                        const tagIds = threadTagIdsByThread.get(thread.id) ?? [];
                        return (
                            <button
                                key={thread.id}
                                type='button'
                                className={`w-full rounded-lg border p-2 text-left ${
                                    selectedThreadId === thread.id
                                        ? 'border-primary bg-primary/10'
                                        : 'border-border bg-background hover:bg-accent'
                                }`}
                                onClick={() => {
                                    onSelectThread(thread.id);
                                }}>
                                <p className='truncate text-sm font-medium'>{thread.title}</p>
                                <p className='text-muted-foreground mt-0.5 text-xs'>
                                    {thread.scope}
                                    {thread.workspaceFingerprint ? ` · ${thread.workspaceFingerprint}` : ''}
                                </p>
                                {tagIds.length > 0 ? (
                                    <div className='mt-1 flex flex-wrap gap-1'>
                                        {tagIds.map((tagId) => (
                                            <span
                                                key={tagId}
                                                className='bg-secondary text-secondary-foreground rounded px-1.5 py-0.5 text-[10px]'>
                                                {tagLabelById.get(tagId) ?? tagId}
                                            </span>
                                        ))}
                                    </div>
                                ) : null}
                            </button>
                        );
                    })}
                </div>
            </div>
        </aside>
    );
}
