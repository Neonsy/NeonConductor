import { access } from 'node:fs/promises';

import { conversationStore, threadStore, workspaceRootStore, worktreeStore } from '@/app/backend/persistence/stores';
import type { ThreadRecord, WorktreeRecord } from '@/app/backend/persistence/types';
import type {
    WorktreeConfigureThreadInput,
    WorktreeCreateInput,
    WorktreeRefreshResult,
    WorktreeRemoveResult,
    WorktreeRemoveInput,
    WorktreeRemoveOrphanedResult,
} from '@/app/backend/runtime/contracts';
import { errOp, okOp, type OperationalResult } from '@/app/backend/runtime/services/common/operationalError';
import {
    buildManagedWorktreePath,
    createManagedGitWorktree,
    detectWorktreeStatus,
    removeManagedGitWorktree,
    resolveGitWorkspaceInfo,
} from '@/app/backend/runtime/services/worktree/git';

function defaultWorktreeLabel(branch: string): string {
    return branch;
}

async function ensureWorkspaceRoot(profileId: string, workspaceFingerprint: string) {
    const workspaceRoot = await workspaceRootStore.getByFingerprint(profileId, workspaceFingerprint);
    if (!workspaceRoot) {
        return errOp('not_found', `Workspace "${workspaceFingerprint}" is not registered.`);
    }

    return okOp(workspaceRoot);
}

export class WorktreeService {
    async list(profileId: string, workspaceFingerprint?: string): Promise<WorktreeRecord[]> {
        return workspaceFingerprint
            ? worktreeStore.listByWorkspace(profileId, workspaceFingerprint)
            : worktreeStore.listByProfile(profileId);
    }

    async create(input: WorktreeCreateInput): Promise<OperationalResult<WorktreeRecord>> {
        const workspaceRootResult = await ensureWorkspaceRoot(input.profileId, input.workspaceFingerprint);
        if (workspaceRootResult.isErr()) {
            return errOp(workspaceRootResult.error.code, workspaceRootResult.error.message);
        }

        const existing = await worktreeStore.getByBranch(input.profileId, input.workspaceFingerprint, input.branch);
        if (existing) {
            return okOp(existing);
        }

        const workspaceRoot = workspaceRootResult.value;
        const gitInfo = await resolveGitWorkspaceInfo({
            workspaceRootPath: workspaceRoot.absolutePath,
        });
        if (gitInfo.isErr()) {
            return errOp(
                gitInfo.error.reason === 'workspace_not_git' ? 'request_unavailable' : 'request_failed',
                gitInfo.error.detail
            );
        }

        const baseBranch = input.baseBranch?.trim() || gitInfo.value.currentBranch;
        const targetPath = buildManagedWorktreePath({
            workspaceLabel: workspaceRoot.label,
            branch: input.branch,
        });
        const created = await createManagedGitWorktree({
            workspaceRootPath: workspaceRoot.absolutePath,
            targetPath,
            branch: input.branch,
            baseBranch,
        });
        if (created.isErr()) {
            return errOp(
                created.error.reason === 'workspace_not_git' ? 'request_unavailable' : 'request_failed',
                created.error.detail
            );
        }

        const record = await worktreeStore.create({
            profileId: input.profileId,
            workspaceFingerprint: input.workspaceFingerprint,
            branch: input.branch,
            baseBranch,
            absolutePath: targetPath,
            label: input.label?.trim() || defaultWorktreeLabel(input.branch),
            status: 'ready',
        });

        return okOp(record);
    }

    async refresh(profileId: string, worktreeId: string): Promise<WorktreeRefreshResult> {
        const worktree = await worktreeStore.getById(profileId, worktreeId);
        if (!worktree) {
            return {
                refreshed: false,
                reason: 'not_found',
            };
        }

        const status = await detectWorktreeStatus(worktree.absolutePath);
        const refreshed = await worktreeStore.update({
            profileId,
            worktreeId,
            status,
            touchLastUsed: status === 'ready',
        });

        return {
            refreshed: true,
            ...(refreshed ? { worktree: refreshed } : {}),
        };
    }

    async remove(input: WorktreeRemoveInput): Promise<WorktreeRemoveResult> {
        const worktree = await worktreeStore.getById(input.profileId, input.worktreeId);
        if (!worktree) {
            return { removed: false, reason: 'not_found', affectedThreadIds: [] };
        }
        if (await worktreeStore.hasRunningSession(input.profileId, worktree.id)) {
            return {
                removed: false,
                reason: 'active_session',
                message: 'Active sessions are still running in this managed worktree.',
                affectedThreadIds: [],
            };
        }

        const workspaceRoot = await workspaceRootStore.getByFingerprint(input.profileId, worktree.workspaceFingerprint);
        if (!workspaceRoot) {
            return {
                removed: false,
                reason: 'workspace_unresolved',
                message: 'Base workspace root could not be resolved.',
                affectedThreadIds: [],
            };
        }

        const affectedThreadIds = await threadStore.listIdsByWorktree(input.profileId, worktree.id);

        try {
            await access(worktree.absolutePath);
            const removed = await removeManagedGitWorktree({
                workspaceRootPath: workspaceRoot.absolutePath,
                worktreePath: worktree.absolutePath,
                removeFiles: input.removeFiles ?? true,
            });
            if (removed.isErr()) {
                return {
                    removed: false,
                    reason: 'git_failed',
                    message: removed.error.detail,
                    affectedThreadIds: [],
                };
            }
        } catch {
            // Missing path still allows record cleanup below.
        }

        await worktreeStore.delete(input.profileId, input.worktreeId);
        return {
            removed: true,
            worktreeId: input.worktreeId,
            affectedThreadIds,
        };
    }

    async removeOrphaned(profileId: string): Promise<WorktreeRemoveOrphanedResult> {
        const orphaned = await worktreeStore.listOrphaned(profileId);
        const removedWorktreeIds: WorktreeRemoveOrphanedResult['removedWorktreeIds'] = [];
        const affectedThreadIds: WorktreeRemoveOrphanedResult['affectedThreadIds'] = [];

        for (const worktree of orphaned) {
            const removed = await this.remove({
                profileId,
                worktreeId: worktree.id,
                removeFiles: true,
            });
            if (removed.removed) {
                removedWorktreeIds.push(worktree.id);
                affectedThreadIds.push(...removed.affectedThreadIds);
            }
        }

        return { removedWorktreeIds, affectedThreadIds };
    }

    async configureThread(input: WorktreeConfigureThreadInput): Promise<OperationalResult<ThreadRecord>> {
        const thread = await threadStore.getById(input.profileId, input.threadId);
        if (!thread) {
            return errOp('thread_not_found', `Thread "${input.threadId}" was not found.`);
        }

        const bucket = await conversationStore.getBucketById(input.profileId, thread.conversationId);
        if (!bucket || bucket.scope !== 'workspace' || !bucket.workspaceFingerprint) {
            return errOp('not_found', 'Worktree execution is only available for workspace-bound threads.');
        }
        if (thread.topLevelTab === 'chat') {
            return errOp('unsupported_tab', 'Chat threads use read-only conversation branches and cannot bind worktrees.');
        }

        if (input.mode === 'worktree') {
            const worktree = input.worktreeId ? await worktreeStore.getById(input.profileId, input.worktreeId) : null;
            if (!worktree || worktree.workspaceFingerprint !== bucket.workspaceFingerprint) {
                return errOp('not_found', 'Selected managed worktree was not found for this workspace.');
            }

            const updated = await threadStore.bindWorktree({
                profileId: input.profileId,
                threadId: input.threadId,
                worktreeId: worktree.id,
                branch: worktree.branch,
                baseBranch: worktree.baseBranch,
            });
            return updated ? okOp(updated) : errOp('thread_not_found', `Thread "${input.threadId}" was not found.`);
        }

        const updated = await threadStore.setExecutionEnvironment({
            profileId: input.profileId,
            threadId: input.threadId,
            mode: input.mode,
            ...(input.executionBranch ? { executionBranch: input.executionBranch } : {}),
            ...(input.baseBranch ? { baseBranch: input.baseBranch } : {}),
        });
        if (!updated) {
            return errOp('thread_not_found', `Thread "${input.threadId}" was not found.`);
        }

        return okOp(updated);
    }

    async materializeThreadWorktree(input: {
        profileId: string;
        thread: ThreadRecord;
        workspaceFingerprint: string;
    }): Promise<OperationalResult<WorktreeRecord | null>> {
        if (input.thread.executionEnvironmentMode !== 'new_worktree') {
            return okOp(null);
        }

        const branch = input.thread.executionBranch?.trim();
        if (!branch) {
            return errOp('invalid_input', 'New worktree execution requires a branch name.');
        }

        const created = await this.create({
            profileId: input.profileId,
            workspaceFingerprint: input.workspaceFingerprint,
            branch,
            ...(input.thread.baseBranch ? { baseBranch: input.thread.baseBranch } : {}),
            label: defaultWorktreeLabel(branch),
        });
        if (created.isErr()) {
            return created;
        }

        const bound = await threadStore.bindWorktree({
            profileId: input.profileId,
            threadId: input.thread.id,
            worktreeId: created.value.id,
            branch: created.value.branch,
            baseBranch: created.value.baseBranch,
        });
        if (!bound) {
            return errOp('thread_not_found', `Thread "${input.thread.id}" was not found.`);
        }

        return okOp(created.value);
    }
}

export const worktreeService = new WorktreeService();
