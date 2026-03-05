import type { ThreadListRecord } from '@/app/backend/persistence/types';

export interface ThreadRenderRow {
    thread: ThreadListRecord;
    depth: number;
}

export function buildBranchRows(threads: ThreadListRecord[]): ThreadRenderRow[] {
    const byId = new Map(threads.map((thread) => [thread.id, thread]));
    const childrenByParent = new Map<string, ThreadListRecord[]>();
    const roots: ThreadListRecord[] = [];

    for (const thread of threads) {
        const parentId = thread.parentThreadId;
        if (!parentId || !byId.has(parentId)) {
            roots.push(thread);
            continue;
        }
        const existing = childrenByParent.get(parentId) ?? [];
        existing.push(thread);
        childrenByParent.set(parentId, existing);
    }

    const rows: ThreadRenderRow[] = [];
    const stack: Array<{ thread: ThreadListRecord; depth: number }> = roots
        .slice()
        .reverse()
        .map((thread) => ({ thread, depth: 0 }));

    while (stack.length > 0) {
        const current = stack.pop();
        if (!current) {
            continue;
        }
        rows.push(current);
        const children = childrenByParent.get(current.thread.id) ?? [];
        for (let index = children.length - 1; index >= 0; index -= 1) {
            const child = children[index];
            if (!child) {
                continue;
            }
            stack.push({
                thread: child,
                depth: current.depth + 1,
            });
        }
    }

    return rows;
}
