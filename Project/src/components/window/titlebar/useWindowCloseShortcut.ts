import { useEffect } from 'react';

interface UseWindowCloseShortcutInput {
    platform: 'darwin' | 'win32' | 'linux';
    onClose: () => void;
}

export function useWindowCloseShortcut(input: UseWindowCloseShortcutInput): void {
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.repeat) {
                return;
            }

            const isCloseWindowShortcut =
                input.platform === 'darwin'
                    ? event.metaKey && !event.ctrlKey && !event.altKey && event.code === 'KeyW'
                    : event.ctrlKey && event.shiftKey && !event.altKey && event.code === 'KeyW';

            if (!isCloseWindowShortcut) {
                return;
            }

            event.preventDefault();
            input.onClose();
        };

        window.addEventListener('keydown', onKeyDown);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [input.onClose, input.platform]);
}
