export type EnvironmentDraft = 'local' | 'new_worktree' | 'worktree';

export type ExecutionEnvironmentScope =
    | {
          kind: 'detached';
      }
    | {
          kind: 'workspace';
          label: string;
          absolutePath: string;
          executionEnvironmentMode: 'local' | 'new_worktree';
          executionBranch?: string;
          baseBranch?: string;
      }
    | {
          kind: 'worktree';
          label: string;
          absolutePath: string;
          branch: string;
          baseBranch: string;
          baseWorkspaceLabel: string;
          baseWorkspacePath: string;
          worktreeId: string;
      };

export interface ExecutionEnvironmentDraftState {
    scopeKey: string;
    draftMode: EnvironmentDraft;
    branch: string;
    baseBranch: string;
    selectedWorktreeId: string;
}

export function getExecutionEnvironmentScopeKey(input: ExecutionEnvironmentScope): string {
    if (input.kind === 'detached') {
        return 'detached';
    }

    if (input.kind === 'worktree') {
        return `worktree:${input.worktreeId}:${input.branch}:${input.baseBranch}`;
    }

    return `workspace:${input.absolutePath}:${input.executionEnvironmentMode}:${input.executionBranch ?? ''}:${input.baseBranch ?? ''}`;
}

export function resolveExecutionEnvironmentDraftState(input: {
    workspaceScope: ExecutionEnvironmentScope;
    draftState: ExecutionEnvironmentDraftState | undefined;
}): ExecutionEnvironmentDraftState {
    const scopeKey = getExecutionEnvironmentScopeKey(input.workspaceScope);
    if (input.draftState?.scopeKey === scopeKey) {
        return input.draftState;
    }

    if (input.workspaceScope.kind === 'worktree') {
        return {
            scopeKey,
            draftMode: 'worktree',
            branch: input.workspaceScope.branch,
            baseBranch: input.workspaceScope.baseBranch,
            selectedWorktreeId: input.workspaceScope.worktreeId,
        };
    }

    if (input.workspaceScope.kind === 'workspace') {
        return {
            scopeKey,
            draftMode: input.workspaceScope.executionEnvironmentMode,
            branch: input.workspaceScope.executionBranch ?? '',
            baseBranch: input.workspaceScope.baseBranch ?? '',
            selectedWorktreeId: '',
        };
    }

    return {
        scopeKey,
        draftMode: 'local',
        branch: '',
        baseBranch: '',
        selectedWorktreeId: '',
    };
}
