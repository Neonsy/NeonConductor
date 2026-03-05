import type { ThreadListRecord } from '@/app/backend/persistence/types';

export type ThreadSort = 'latest' | 'alphabetical';

export function toAnchorKey(thread: ThreadListRecord): string {
    if (thread.anchorKind === 'playground') {
        return 'playground';
    }

    return `workspace:${thread.anchorId ?? 'unknown'}`;
}

export function compareIsoDesc(left?: string, right?: string): number {
    const leftValue = left ?? '';
    const rightValue = right ?? '';
    if (leftValue > rightValue) return -1;
    if (leftValue < rightValue) return 1;
    return 0;
}

export function compareAnchor(left: ThreadListRecord, right: ThreadListRecord): number {
    if (left.anchorKind !== right.anchorKind) {
        return left.anchorKind === 'workspace' ? -1 : 1;
    }

    const leftAnchor = left.anchorId ?? '';
    const rightAnchor = right.anchorId ?? '';
    if (leftAnchor !== rightAnchor) {
        return leftAnchor.localeCompare(rightAnchor, undefined, {
            sensitivity: 'base',
            numeric: true,
        });
    }

    return 0;
}

export function getThreadActivity(thread: ThreadListRecord): string {
    return thread.lastAssistantAt ?? thread.latestSessionUpdatedAt ?? thread.updatedAt;
}

export function getAnchorActivity(threads: ThreadListRecord[]): string {
    let latest = '';
    for (const thread of threads) {
        const activity = getThreadActivity(thread);
        if (activity > latest) {
            latest = activity;
        }
    }
    return latest;
}

export function compareThreadOrder(left: ThreadListRecord, right: ThreadListRecord, sort: ThreadSort): number {
    if (sort === 'alphabetical') {
        const titleCompare = left.title.localeCompare(right.title, undefined, {
            sensitivity: 'base',
            numeric: true,
        });
        if (titleCompare !== 0) {
            return titleCompare;
        }
    } else {
        const activityCompare = compareIsoDesc(getThreadActivity(left), getThreadActivity(right));
        if (activityCompare !== 0) {
            return activityCompare;
        }
    }

    return left.id.localeCompare(right.id);
}

export function flattenBranchView(threads: ThreadListRecord[], sort: ThreadSort): ThreadListRecord[] {
    const byAnchor = new Map<string, ThreadListRecord[]>();
    for (const thread of threads) {
        const key = toAnchorKey(thread);
        const existing = byAnchor.get(key) ?? [];
        existing.push(thread);
        byAnchor.set(key, existing);
    }

    const orderedAnchors = Array.from(byAnchor.values()).sort((leftGroup, rightGroup) => {
        const leftFirst = leftGroup[0];
        const rightFirst = rightGroup[0];
        if (!leftFirst || !rightFirst) {
            return leftGroup.length - rightGroup.length;
        }
        const activityCompare = compareIsoDesc(getAnchorActivity(leftGroup), getAnchorActivity(rightGroup));
        if (activityCompare !== 0) {
            return activityCompare;
        }
        return compareAnchor(leftFirst, rightFirst);
    });

    const ordered: ThreadListRecord[] = [];
    for (const anchorThreads of orderedAnchors) {
        const threadById = new Map(anchorThreads.map((thread) => [thread.id, thread]));
        const childrenByParent = new Map<string, ThreadListRecord[]>();
        const roots: ThreadListRecord[] = [];

        for (const thread of anchorThreads) {
            const parentId = thread.parentThreadId;
            if (!parentId || !threadById.has(parentId)) {
                roots.push(thread);
                continue;
            }

            const existing = childrenByParent.get(parentId) ?? [];
            existing.push(thread);
            childrenByParent.set(parentId, existing);
        }

        roots.sort((left, right) => compareThreadOrder(left, right, sort));
        for (const children of childrenByParent.values()) {
            children.sort((left, right) => compareThreadOrder(left, right, sort));
        }

        const stack = [...roots].reverse();
        while (stack.length > 0) {
            const current = stack.pop();
            if (!current) {
                continue;
            }
            ordered.push(current);
            const children = childrenByParent.get(current.id);
            if (!children || children.length === 0) {
                continue;
            }
            for (let index = children.length - 1; index >= 0; index -= 1) {
                const child = children[index];
                if (child) {
                    stack.push(child);
                }
            }
        }
    }

    return ordered;
}
