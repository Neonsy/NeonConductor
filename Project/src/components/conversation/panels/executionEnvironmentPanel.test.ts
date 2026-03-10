import { describe, expect, it } from 'vitest';

import {
    getExecutionEnvironmentScopeKey,
    resolveExecutionEnvironmentDraftState,
} from '@/web/components/conversation/panels/executionEnvironmentPanelState';

describe('execution environment draft state', () => {
    it('keeps keyed drafts for the active scope and falls back to workspace defaults for a new scope', () => {
        const workspaceScope = {
            kind: 'workspace',
            label: 'Workspace',
            absolutePath: 'C:\\workspace',
            executionEnvironmentMode: 'new_worktree',
            executionBranch: 'feature/server',
            baseBranch: 'main',
        } as const;

        expect(
            resolveExecutionEnvironmentDraftState({
                workspaceScope: workspaceScope as never,
                draftState: {
                    scopeKey: getExecutionEnvironmentScopeKey(workspaceScope as never),
                    draftMode: 'worktree',
                    branch: 'feature/draft',
                    baseBranch: 'develop',
                    selectedWorktreeId: 'wt_1',
                },
            })
        ).toEqual({
            scopeKey: getExecutionEnvironmentScopeKey(workspaceScope as never),
            draftMode: 'worktree',
            branch: 'feature/draft',
            baseBranch: 'develop',
            selectedWorktreeId: 'wt_1',
        });

        expect(
            resolveExecutionEnvironmentDraftState({
                workspaceScope: {
                    ...workspaceScope,
                    executionBranch: 'feature/other',
                } as never,
                draftState: {
                    scopeKey: getExecutionEnvironmentScopeKey(workspaceScope as never),
                    draftMode: 'worktree',
                    branch: 'feature/draft',
                    baseBranch: 'develop',
                    selectedWorktreeId: 'wt_1',
                },
            })
        ).toEqual({
            scopeKey: getExecutionEnvironmentScopeKey({
                ...workspaceScope,
                executionBranch: 'feature/other',
            } as never),
            draftMode: 'new_worktree',
            branch: 'feature/other',
            baseBranch: 'main',
            selectedWorktreeId: '',
        });
    });
});
