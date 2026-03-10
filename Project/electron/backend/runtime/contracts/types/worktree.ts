import type { ExecutionEnvironmentMode, WorktreeStatus } from '@/app/backend/runtime/contracts/enums';
import type { EntityId } from '@/app/backend/runtime/contracts/ids';
import type { ProfileInput } from '@/app/backend/runtime/contracts/types/common';

export interface WorktreeRecord {
    id: EntityId<'wt'>;
    profileId: string;
    workspaceFingerprint: string;
    branch: string;
    baseBranch: string;
    absolutePath: string;
    label: string;
    status: WorktreeStatus;
    createdAt: string;
    updatedAt: string;
    lastUsedAt: string;
}

export type ResolvedWorkspaceContext =
    | {
          kind: 'detached';
      }
    | {
          kind: 'workspace';
          workspaceFingerprint: string;
          label: string;
          absolutePath: string;
          executionEnvironmentMode: Extract<ExecutionEnvironmentMode, 'local' | 'new_worktree'>;
          executionBranch?: string;
          baseBranch?: string;
      }
    | {
          kind: 'worktree';
          workspaceFingerprint: string;
          label: string;
          absolutePath: string;
          executionEnvironmentMode: 'worktree';
          worktree: WorktreeRecord;
          baseWorkspace: {
              label: string;
              absolutePath: string;
          };
      };

export interface WorktreeListInput extends ProfileInput {
    workspaceFingerprint?: string;
}

export interface WorktreeCreateInput extends ProfileInput {
    workspaceFingerprint: string;
    branch: string;
    baseBranch?: string;
    label?: string;
}

export interface WorktreeByIdInput extends ProfileInput {
    worktreeId: EntityId<'wt'>;
}

export interface WorktreeRefreshResult {
    refreshed: boolean;
    worktree?: WorktreeRecord;
    reason?: 'not_found';
}

export interface WorktreeRemoveResult {
    removed: boolean;
    worktreeId?: EntityId<'wt'>;
    affectedThreadIds: EntityId<'thr'>[];
    reason?: 'not_found' | 'active_session' | 'workspace_unresolved' | 'git_failed';
    message?: string;
}

export interface WorktreeRemoveInput extends WorktreeByIdInput {
    removeFiles?: boolean;
}

export interface WorktreeRemoveOrphanedResult {
    removedWorktreeIds: EntityId<'wt'>[];
    affectedThreadIds: EntityId<'thr'>[];
}

export interface WorktreeConfigureThreadInput extends ProfileInput {
    threadId: EntityId<'thr'>;
    mode: ExecutionEnvironmentMode;
    executionBranch?: string;
    baseBranch?: string;
    worktreeId?: EntityId<'wt'>;
}
