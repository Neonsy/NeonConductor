import { ConfirmDialog } from '@/web/components/ui/confirmDialog';

export function WorkspaceDeleteConversationsDialog(input: {
    workspaceLabel?: string;
    open: boolean;
    busy: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    return (
        <ConfirmDialog
            open={input.open}
            title='Delete Workspace Conversations'
            message={`Delete all conversations anchored to ${input.workspaceLabel ?? 'this workspace'}? This does not remove the workspace root on disk.`}
            confirmLabel='Delete conversations'
            destructive
            busy={input.busy}
            onCancel={input.onCancel}
            onConfirm={input.onConfirm}
        />
    );
}
