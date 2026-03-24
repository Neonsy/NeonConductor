export type SidebarMutationResult =
    | { ok: true }
    | {
          ok: false;
          message: string;
      };

export function sidebarMutationSuccess(): SidebarMutationResult {
    return { ok: true };
}

export function sidebarMutationFailure(message: string): SidebarMutationResult {
    return {
        ok: false,
        message,
    };
}
