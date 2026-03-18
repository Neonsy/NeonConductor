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

function buildWorkspaceRows(threads: ThreadListRecord[]): ThreadRenderRow[] {
    const byId = new Map(threads.map((thread) => [thread.id, thread] as const));
    const delegatedChildrenByParent = new Map<string, ThreadListRecord[]>();
    const rootRows: ThreadListRecord[] = [];

    for (const thread of threads) {
        const parentId = thread.parentThreadId;
        const parentThread = parentId ? byId.get(parentId) : undefined;
        const shouldNestUnderParent =
            Boolean(thread.delegatedFromOrchestratorRunId) && Boolean(parentId) && Boolean(parentThread);
        if (!shouldNestUnderParent || !parentId) {
            rootRows.push(thread);
            continue;
        }

        const existingChildren = delegatedChildrenByParent.get(parentId) ?? [];
        existingChildren.push(thread);
        delegatedChildrenByParent.set(parentId, existingChildren);
    }

    const rows: ThreadRenderRow[] = [];
    const stack = rootRows
        .slice()
        .reverse()
        .map((thread) => ({
            thread,
            depth: 0,
        }));

    while (stack.length > 0) {
        const current = stack.pop();
        if (!current) {
            continue;
        }

        rows.push(current);
        const delegatedChildren = delegatedChildrenByParent.get(current.thread.id) ?? [];
        for (let index = delegatedChildren.length - 1; index >= 0; index -= 1) {
            const childThread = delegatedChildren[index];
            if (!childThread) {
                continue;
            }

            stack.push({
                thread: childThread,
                depth: current.depth + 1,
            });
        }
    }

    return rows;
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
        ...new Set([
            ...input.workspaceRoots.map((workspaceRoot) => workspaceRoot.fingerprint),
            ...input.buckets
                .filter((bucket) => bucket.scope === 'workspace')
                .map((bucket) => bucket.workspaceFingerprint),
        ]),
    ]
        .filter((fingerprint): fingerprint is string => Boolean(fingerprint))
        .sort((left, right) => left.localeCompare(right));

    const tagLabelById = new Map(input.tags.map((tag) => [tag.id, tag.label]));
    const selectedThread = input.selectedThreadId
        ? input.threads.find((thread) => thread.id === input.selectedThreadId)
        : undefined;

    const grouped = new Map<string, GroupedThreadRowsSection>();
    for (const workspaceRoot of input.workspaceRoots) {
        grouped.set(`ws:${workspaceRoot.fingerprint}`, {
            label: workspaceRoot.label,
            workspaceFingerprint: workspaceRoot.fingerprint,
            ...(workspaceRoot.absolutePath ? { absolutePath: workspaceRoot.absolutePath } : {}),
            favoriteCount: 0,
            threadCount: 0,
            rows: [],
        });
    }

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
                : buildWorkspaceRows(anchorThreads);
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
                : buildWorkspaceRows(playgroundThreads),
    };
}
