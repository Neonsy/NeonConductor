import { useEffect, useMemo } from 'react';

import type { ThreadListRecord, ThreadTagRecord } from '@/app/backend/persistence/types';

interface UseThreadSidebarStateInput {
    threads: ThreadListRecord[];
    threadTags: ThreadTagRecord[];
    selectedTagId: string | undefined;
    selectedThreadId: string | undefined;
    onSelectedThreadInvalid: () => void;
    onSelectFallbackThread: (threadId: string) => void;
}

export interface ThreadSidebarState {
    threadTagIdsByThread: Map<string, string[]>;
    visibleThreads: ThreadListRecord[];
}

export function useThreadSidebarState(input: UseThreadSidebarStateInput): ThreadSidebarState {
    const selectedTagId = input.selectedTagId;

    const threadTagIdsByThread = useMemo(() => {
        const map = new Map<string, string[]>();
        for (const relation of input.threadTags) {
            const existing = map.get(relation.threadId) ?? [];
            existing.push(relation.tagId);
            map.set(relation.threadId, existing);
        }

        return map;
    }, [input.threadTags]);

    const visibleThreads = useMemo(() => {
        if (!selectedTagId) {
            return input.threads;
        }

        return input.threads.filter((thread) => (threadTagIdsByThread.get(thread.id) ?? []).includes(selectedTagId));
    }, [input.threads, selectedTagId, threadTagIdsByThread]);

    useEffect(() => {
        if (visibleThreads.length === 0) {
            input.onSelectedThreadInvalid();
            return;
        }

        if (input.selectedThreadId && visibleThreads.some((thread) => thread.id === input.selectedThreadId)) {
            return;
        }

        const firstVisibleThread = visibleThreads.at(0);
        if (firstVisibleThread) {
            input.onSelectFallbackThread(firstVisibleThread.id);
        }
    }, [input.onSelectFallbackThread, input.onSelectedThreadInvalid, input.selectedThreadId, visibleThreads]);

    return {
        threadTagIdsByThread,
        visibleThreads,
    };
}
