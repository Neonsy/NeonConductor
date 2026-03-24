export type WorkspaceActionMutationResult =
    | {
          ok: true;
      }
    | {
          ok: false;
          message: string;
      };

export function workspaceActionMutationSuccess(): WorkspaceActionMutationResult {
    return {
        ok: true,
    };
}

export function workspaceActionMutationFailure(message: string): WorkspaceActionMutationResult {
    return {
        ok: false,
        message,
    };
}
