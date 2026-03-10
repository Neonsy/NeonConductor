import { useState } from 'react';

import {
    resolveExecutionEnvironmentDraftState,
    type ExecutionEnvironmentDraftState,
    type ExecutionEnvironmentScope,
} from '@/web/components/conversation/panels/executionEnvironmentPanelState';
import { Button } from '@/web/components/ui/button';

import type { ThreadListRecord, WorktreeRecord } from '@/app/backend/persistence/types';
import type { TopLevelTab } from '@/app/backend/runtime/contracts';

interface ExecutionEnvironmentPanelProps {
    topLevelTab: TopLevelTab;
    selectedThread: ThreadListRecord | undefined;
    workspaceScope: ExecutionEnvironmentScope;
    worktrees: WorktreeRecord[];
    busy: boolean;
    feedbackMessage?: string;
    feedbackTone?: 'success' | 'error' | 'info';
    onConfigureThread: (input: {
        mode: 'local' | 'new_worktree' | 'worktree';
        executionBranch?: string;
        baseBranch?: string;
        worktreeId?: string;
    }) => void;
    onRefreshWorktree: (worktreeId: string) => void;
    onRemoveWorktree: (worktreeId: string) => void;
    onRemoveOrphaned: () => void;
}

export function ExecutionEnvironmentPanel({
    topLevelTab,
    selectedThread,
    workspaceScope,
    worktrees,
    busy,
    feedbackMessage,
    feedbackTone = 'info',
    onConfigureThread,
    onRefreshWorktree,
    onRemoveWorktree,
    onRemoveOrphaned,
}: ExecutionEnvironmentPanelProps) {
    const [draftState, setDraftState] = useState<ExecutionEnvironmentDraftState | undefined>(undefined);
    const resolvedDraftState = resolveExecutionEnvironmentDraftState({
        workspaceScope,
        draftState,
    });
    const draftMode = resolvedDraftState.draftMode;
    const branch = resolvedDraftState.branch;
    const baseBranch = resolvedDraftState.baseBranch;
    const selectedWorktreeId = resolvedDraftState.selectedWorktreeId;

    if (!selectedThread) {
        return null;
    }

    if (topLevelTab === 'chat') {
        return (
            <section className='border-border bg-card mb-3 rounded-2xl border p-3'>
                <p className='text-sm font-semibold'>Conversation Branching</p>
                <p className='text-muted-foreground mt-1 text-xs'>
                    Chat uses read-only conversation branches only. Selecting “Conversation Branches” in the sidebar
                    changes message lineage, not the filesystem. Chat never creates a managed worktree.
                </p>
            </section>
        );
    }

    if (workspaceScope.kind === 'detached') {
        return (
            <section className='border-border bg-card mb-3 rounded-2xl border p-3'>
                <p className='text-sm font-semibold'>Execution Environment</p>
                <p className='text-muted-foreground mt-1 text-xs'>
                    Detached threads have no filesystem authority. Use a workspace thread to choose between the local
                    workspace and a managed worktree environment.
                </p>
            </section>
        );
    }

    return (
        <section className='border-border bg-card mb-3 rounded-2xl border p-3'>
            <div className='flex flex-wrap items-start justify-between gap-3'>
                <div>
                    <p className='text-sm font-semibold'>Execution Environment</p>
                    <p className='text-muted-foreground mt-1 text-xs'>
                        Agent and orchestrator threads can run in the local workspace or a managed worktree. This is
                        separate from chat-style conversation branching.
                    </p>
                </div>
                <div className='text-muted-foreground text-right text-xs [font-variant-numeric:tabular-nums]'>
                    <p>{worktrees.length} managed</p>
                    <p>{workspaceScope.kind === 'worktree' ? workspaceScope.branch : 'local workspace'}</p>
                </div>
            </div>

            <div className='mt-3 grid gap-2 md:grid-cols-3'>
                <Button
                    type='button'
                    variant={draftMode === 'local' ? 'secondary' : 'outline'}
                    disabled={busy}
                    onClick={() => {
                        setDraftState({
                            ...resolvedDraftState,
                            draftMode: 'local',
                        });
                    }}>
                    Local Workspace
                </Button>
                <Button
                    type='button'
                    variant={draftMode === 'new_worktree' ? 'secondary' : 'outline'}
                    disabled={busy}
                    onClick={() => {
                        setDraftState({
                            ...resolvedDraftState,
                            draftMode: 'new_worktree',
                        });
                    }}>
                    New Worktree
                </Button>
                <Button
                    type='button'
                    variant={draftMode === 'worktree' ? 'secondary' : 'outline'}
                    disabled={busy || worktrees.length === 0}
                    onClick={() => {
                        setDraftState({
                            ...resolvedDraftState,
                            draftMode: 'worktree',
                        });
                    }}>
                    Existing Worktree
                </Button>
            </div>

            {draftMode === 'new_worktree' ? (
                <div className='mt-3 grid gap-2 md:grid-cols-2'>
                    <input
                        value={branch}
                        onChange={(event) => {
                            setDraftState({
                                ...resolvedDraftState,
                                branch: event.target.value,
                            });
                        }}
                        className='border-border bg-background h-11 rounded-xl border px-3 text-sm'
                        placeholder='feature/my-branch'
                    />
                    <input
                        value={baseBranch}
                        onChange={(event) => {
                            setDraftState({
                                ...resolvedDraftState,
                                baseBranch: event.target.value,
                            });
                        }}
                        className='border-border bg-background h-11 rounded-xl border px-3 text-sm'
                        placeholder='base branch (optional)'
                    />
                </div>
            ) : null}

            {draftMode === 'worktree' ? (
                <select
                    value={selectedWorktreeId}
                    onChange={(event) => {
                        setDraftState({
                            ...resolvedDraftState,
                            selectedWorktreeId: event.target.value,
                        });
                    }}
                    className='border-border bg-background mt-3 h-11 w-full rounded-xl border px-3 text-sm'>
                    <option value=''>Select managed worktree</option>
                    {worktrees.map((worktree) => (
                        <option key={worktree.id} value={worktree.id}>
                            {worktree.branch} · {worktree.label} · {worktree.status}
                        </option>
                    ))}
                </select>
            ) : null}

            <div className='mt-3 flex flex-wrap gap-2'>
                <Button
                    type='button'
                    disabled={
                        busy ||
                        (draftMode === 'new_worktree' && branch.trim().length === 0) ||
                        (draftMode === 'worktree' && selectedWorktreeId.trim().length === 0)
                    }
                    onClick={() => {
                        onConfigureThread({
                            mode: draftMode,
                            ...(draftMode === 'new_worktree' && branch.trim().length > 0
                                ? { executionBranch: branch.trim() }
                                : {}),
                            ...(draftMode === 'new_worktree' && baseBranch.trim().length > 0
                                ? { baseBranch: baseBranch.trim() }
                                : {}),
                            ...(draftMode === 'worktree' ? { worktreeId: selectedWorktreeId } : {}),
                        });
                    }}>
                    {draftMode === 'local'
                        ? 'Use Local Workspace'
                        : draftMode === 'new_worktree'
                          ? 'Queue Managed Worktree'
                          : 'Attach Managed Worktree'}
                </Button>
                {workspaceScope.kind === 'worktree' ? (
                    <>
                        <Button
                            type='button'
                            variant='outline'
                            disabled={busy}
                            onClick={() => {
                                onRefreshWorktree(workspaceScope.worktreeId);
                            }}>
                            Refresh Status
                        </Button>
                        <Button
                            type='button'
                            variant='outline'
                            disabled={busy}
                            onClick={() => {
                                onRemoveWorktree(workspaceScope.worktreeId);
                            }}>
                            Remove Worktree
                        </Button>
                    </>
                ) : null}
                <Button type='button' variant='outline' disabled={busy || worktrees.length === 0} onClick={onRemoveOrphaned}>
                    Cleanup Orphaned
                </Button>
            </div>

            {feedbackMessage ? (
                <div
                    aria-live='polite'
                    className={`mt-3 rounded-xl border px-3 py-2 text-xs ${
                        feedbackTone === 'error'
                            ? 'border-destructive/20 bg-destructive/10 text-destructive'
                            : feedbackTone === 'success'
                              ? 'border-primary/20 bg-primary/10 text-primary'
                              : 'border-border bg-background/70 text-muted-foreground'
                    }`}>
                    {feedbackMessage}
                </div>
            ) : null}

            <div className='text-muted-foreground mt-3 text-xs'>
                {workspaceScope.kind === 'worktree' ? (
                    <p>
                        Running in managed worktree <span className='font-medium text-foreground'>{workspaceScope.branch}</span>
                        {' '}from {workspaceScope.baseWorkspaceLabel}. Filesystem operations, diffs, checkpoints, and shell
                        commands use {workspaceScope.absolutePath}.
                    </p>
                ) : (
                    <p>
                        Running in the local workspace at {workspaceScope.absolutePath}. If you queue a new worktree, it
                        will be created lazily on the first run that needs a real execution environment.
                    </p>
                )}
            </div>
        </section>
    );
}
