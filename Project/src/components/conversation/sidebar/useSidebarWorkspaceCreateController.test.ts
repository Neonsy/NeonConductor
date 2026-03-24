import { describe, expect, it, vi } from 'vitest';

import { browseSidebarWorkspaceDirectory } from '@/web/components/conversation/sidebar/useSidebarWorkspaceCreateController';

describe('browseSidebarWorkspaceDirectory', () => {
    it('returns the selected path when the desktop picker succeeds', async () => {
        const onPickingWorkspaceDirectoryChange = vi.fn();
        const onWorkspaceCreateErrorChange = vi.fn();

        const result = await browseSidebarWorkspaceDirectory({
            desktopBridge: {
                pickDirectory: vi.fn(() =>
                    Promise.resolve({
                        canceled: false,
                        absolutePath: 'C:/workspace',
                    })
                ),
            } as typeof window.neonDesktop,
            isPickingWorkspaceDirectory: false,
            onPickingWorkspaceDirectoryChange,
            onWorkspaceCreateErrorChange,
        });

        expect(result).toBe('C:/workspace');
        expect(onWorkspaceCreateErrorChange).toHaveBeenNthCalledWith(1, undefined);
        expect(onPickingWorkspaceDirectoryChange).toHaveBeenNthCalledWith(1, true);
        expect(onPickingWorkspaceDirectoryChange).toHaveBeenNthCalledWith(2, false);
    });

    it('fails closed and reports browse errors through the dialog status channel', async () => {
        const onPickingWorkspaceDirectoryChange = vi.fn();
        const onWorkspaceCreateErrorChange = vi.fn();

        const result = await browseSidebarWorkspaceDirectory({
            desktopBridge: {
                pickDirectory: vi.fn(() => Promise.reject(new Error('Picker failed.'))),
            } as typeof window.neonDesktop,
            isPickingWorkspaceDirectory: false,
            onPickingWorkspaceDirectoryChange,
            onWorkspaceCreateErrorChange,
        });

        expect(result).toBeUndefined();
        expect(onWorkspaceCreateErrorChange).toHaveBeenNthCalledWith(1, undefined);
        expect(onWorkspaceCreateErrorChange).toHaveBeenNthCalledWith(2, 'Picker failed.');
        expect(onPickingWorkspaceDirectoryChange).toHaveBeenNthCalledWith(1, true);
        expect(onPickingWorkspaceDirectoryChange).toHaveBeenNthCalledWith(2, false);
    });
});
