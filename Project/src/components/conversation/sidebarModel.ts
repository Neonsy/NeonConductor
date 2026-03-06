import { buildBranchRows, type ThreadRenderRow } from '@/web/components/conversation/sidebarBranchRows';

import type { ConversationRecord, TagRecord, ThreadListRecord } from '@/app/backend/persistence/types';

export interface ConversationSidebarModel {
    workspaceOptions: string[];
    tagLabelById: Map<string, string>;
    selectedThread: ThreadListRecord | undefined;
    groupedThreadRows: Array<{
        label: string;
        rows: ThreadRenderRow[];
    }>;
}

export function buildConversationSidebarModel(input: {
    buckets: ConversationRecord[];
    threads: ThreadListRecord[];
    tags: TagRecord[];
    selectedThreadId?: string;
    groupView: 'workspace' | 'branch';
}): ConversationSidebarModel {
    const workspaceOptions = [
        ...new Set(
            input.buckets
                .filter((bucket) => bucket.scope === 'workspace')
                .map((bucket) => bucket.workspaceFingerprint)
        ),
    ]
        .filter((fingerprint): fingerprint is string => Boolean(fingerprint))
        .sort((left, right) => left.localeCompare(right));

    const tagLabelById = new Map(input.tags.map((tag) => [tag.id, tag.label]));
    const selectedThread = input.selectedThreadId
        ? input.threads.find((thread) => thread.id === input.selectedThreadId)
        : undefined;

    const grouped = new Map<string, { label: string; rows: ThreadRenderRow[] }>();
    for (const thread of input.threads) {
        const anchorKey = thread.anchorKind === 'workspace' ? `ws:${thread.anchorId ?? ''}` : 'playground';
        if (!grouped.has(anchorKey)) {
            grouped.set(anchorKey, {
                label: thread.anchorKind === 'workspace' ? `Workspace: ${thread.anchorId ?? 'Unknown'}` : 'Playground',
                rows: [],
            });
        }
    }

    for (const [anchorKey, group] of grouped.entries()) {
        const anchorThreads = input.threads.filter((thread) => {
            const key = thread.anchorKind === 'workspace' ? `ws:${thread.anchorId ?? ''}` : 'playground';
            return key === anchorKey;
        });
        group.rows =
            input.groupView === 'branch'
                ? buildBranchRows(anchorThreads)
                : anchorThreads.map((thread) => ({ thread, depth: 0 }));
    }

    return {
        workspaceOptions,
        tagLabelById,
        selectedThread,
        groupedThreadRows: Array.from(grouped.values()),
    };
}
