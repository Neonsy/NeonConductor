import type { TopLevelTab } from '@/app/backend/runtime/contracts/enums';
import type { EntityId } from '@/app/backend/runtime/contracts/ids';
import type { ProfileInput } from '@/app/backend/runtime/contracts/types/common';

export interface CheckpointCreateInput extends ProfileInput {
    runId: EntityId<'run'>;
}

export interface CheckpointListInput extends ProfileInput {
    sessionId: EntityId<'sess'>;
}

export interface CheckpointRollbackPreviewInput extends ProfileInput {
    checkpointId: EntityId<'ckpt'>;
}

export interface CheckpointRollbackPreview {
    checkpointId: EntityId<'ckpt'>;
    executionTargetKey: string;
    executionTargetKind: 'workspace' | 'worktree';
    executionTargetLabel: string;
    isSharedTarget: boolean;
    hasLaterForeignChanges: boolean;
    isHighRisk: boolean;
    affectedSessions: Array<{
        sessionId: EntityId<'sess'>;
        threadId: EntityId<'thr'>;
        topLevelTab: TopLevelTab;
        threadTitle: string;
    }>;
}

export interface CheckpointRollbackInput extends ProfileInput {
    checkpointId: EntityId<'ckpt'>;
    confirm: boolean;
}

export interface CheckpointRollbackResult {
    rolledBack: boolean;
    reason?:
        | 'confirmation_required'
        | 'not_found'
        | 'workspace_unresolved'
        | 'snapshot_invalid'
        | 'restore_failed';
    message?: string;
    checkpoint?: {
        id: EntityId<'ckpt'>;
        sessionId: EntityId<'sess'>;
        threadId: EntityId<'thr'>;
        runId?: EntityId<'run'>;
        topLevelTab: TopLevelTab;
        modeKey: string;
    };
    preview?: CheckpointRollbackPreview;
    safetyCheckpoint?: {
        id: EntityId<'ckpt'>;
        sessionId: EntityId<'sess'>;
        threadId: EntityId<'thr'>;
        runId?: EntityId<'run'>;
        topLevelTab: TopLevelTab;
        modeKey: string;
    };
}
