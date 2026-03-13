import { buildBranchRows, type ThreadRenderRow } from '@/web/components/conversation/sidebar/sidebarBranchRows';

import type { ConversationRecord, TagRecord, ThreadListRecord } from '@/app/backend/persistence/types';

export interface ConversationSidebarModel {
    workspaceOptions: string[];
    tagLabelById: Map<string, string>;
    selectedThread: ThreadListRecord | undefined;
    workspaceGroups: Array<{
        label: string;
        workspaceFingerprint: string;
        absolutePath?: string;
        favoriteCount: number;
        threadCount: number;
        rows: ThreadRenderRow[];
    }>;
    playgroundRows: ThreadRenderRow[];
}

interface GroupedThreadRowsSection {
    label: string;
    workspaceFingerprint: string;
    absolutePath?: string;
    favoriteCount: number;
    threadCount: number;
    rows: ThreadRenderRow[];
}

export function buildConversationSidebarModel(input: {
    buckets: ConversationRecord[];
    threads: ThreadListRecord[];
    tags: TagRecord[];
    workspaceRoots: Array<{
        fingerprint: string;
        label: string;
        absolutePath?: string;
    }>;
    selectedThreadId?: string;
    groupView: 'workspace' | 'branch';
}): ConversationSidebarModel {
    const workspaceLabelByFingerprint = new Map(
        input.workspaceRoots.map((workspaceRoot) => [workspaceRoot.fingerprint, workspaceRoot.label] as const)
    );
    const workspacePathByFingerprint = new Map(
        input.workspaceRoots.map((workspaceRoot) => [workspaceRoot.fingerprint, workspaceRoot.absolutePath] as const)
    );
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

    const grouped = new Map<string, GroupedThreadRowsSection>();
    const playgroundThreads = input.threads.filter((thread) => thread.anchorKind !== 'workspace');
    for (const thread of input.threads) {
        if (thread.anchorKind !== 'workspace' || !thread.anchorId) {
            continue;
        }

        const anchorKey = `ws:${thread.anchorId}`;
        if (!grouped.has(anchorKey)) {
            const absolutePath = workspacePathByFingerprint.get(thread.anchorId);
            grouped.set(anchorKey, {
                label: workspaceLabelByFingerprint.get(thread.anchorId) ?? thread.anchorId,
                workspaceFingerprint: thread.anchorId,
                ...(absolutePath ? { absolutePath } : {}),
                favoriteCount: 0,
                threadCount: 0,
                rows: [],
            });
        }
    }

    for (const [anchorKey, group] of grouped.entries()) {
        const anchorThreads = input.threads.filter(
            (thread) => thread.anchorKind === 'workspace' && `ws:${thread.anchorId ?? ''}` === anchorKey
        );
        group.rows =
            input.groupView === 'branch'
                ? buildBranchRows(anchorThreads)
                : anchorThreads.map((thread) => ({ thread, depth: 0 }));
        group.favoriteCount = anchorThreads.filter((thread) => thread.isFavorite).length;
        group.threadCount = anchorThreads.length;
    }

    return {
        workspaceOptions,
        tagLabelById,
        selectedThread,
        workspaceGroups: Array.from(grouped.values()),
        playgroundRows:
            input.groupView === 'branch'
                ? buildBranchRows(playgroundThreads)
                : playgroundThreads.map((thread) => ({ thread, depth: 0 })),
    };
}
