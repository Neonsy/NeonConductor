import { useState } from 'react';

import { ConfirmDialog } from '@/web/components/ui/confirmDialog';
import PrivacyModeToggle from '@/web/components/window/privacyModeToggle';
import ThemeToggle from '@/web/components/window/themeToggle';
import { MacTitleBarButtons, WindowsTitleBarButtons } from '@/web/components/window/titlebar/platformButtons';
import { useTitleBarWindowControls } from '@/web/components/window/titlebar/useTitleBarWindowControls';
import { useWindowCloseShortcut } from '@/web/components/window/titlebar/useWindowCloseShortcut';
import { UpdateControlsPanel } from '@/web/components/window/updateControlsPanel';

import type { MouseEvent as ReactMouseEvent } from 'react';

export default function TitleBar() {
    const controls = useTitleBarWindowControls();
    const [showUpdatesPanel, setShowUpdatesPanel] = useState(false);
    const [confirmClose, setConfirmClose] = useState(false);

    useWindowCloseShortcut({
        platform: controls.platform,
        onClose: controls.closeWindow,
    });

    const handleHeaderDoubleClick = (event: ReactMouseEvent<HTMLElement>) => {
        const eventTarget = event.target;
        if (!(eventTarget instanceof Element)) return;
        if (eventTarget.closest('[data-no-drag="true"]')) return;
        if (controls.isMac || controls.isFullScreen || !controls.canMaximize) return;
        controls.toggleMaximizeWindow();
    };

    const handleHelpMenuClick = () => {
        setShowUpdatesPanel((current) => !current);
    };

    if (controls.isFullScreen) {
        return null;
    }

    return (
        <header
            className='border-border bg-background/95 text-foreground relative z-10 grid h-9 grid-cols-[1fr_auto_1fr] items-center border-b backdrop-blur-sm select-none [-webkit-app-region:drag]'
            onDoubleClick={handleHeaderDoubleClick}>
            <div className='flex h-full min-w-0 items-center justify-start gap-2 pl-2.5'>
                {controls.isMac ? (
                    <MacTitleBarButtons
                        controlsDisabled={controls.controlsDisabled}
                        canMinimize={controls.canMinimize}
                        canMaximize={controls.canMaximize}
                        isMaximized={controls.isMaximized}
                        onRequestClose={() => {
                            setConfirmClose(true);
                        }}
                        onMinimize={controls.minimizeWindow}
                        onToggleMaximize={controls.toggleMaximizeWindow}
                    />
                ) : null}

                <button
                    type='button'
                    data-no-drag='true'
                    className='text-foreground/75 hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring h-7 rounded-md px-2 text-[12px] font-medium transition-colors [-webkit-app-region:no-drag] focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset disabled:opacity-55'
                    onClick={handleHelpMenuClick}
                    disabled={controls.controlsDisabled}>
                    Help
                </button>
                <PrivacyModeToggle />
                <ThemeToggle />
            </div>

            <div className='flex h-full min-w-0 items-center justify-center text-center'>
                <span className='text-foreground/70 pointer-events-none text-[11px] leading-none font-semibold tracking-[0.12em] uppercase'>
                    NEONCONDUCTOR
                </span>
            </div>

            <div className='flex h-full min-w-0 items-center justify-end'>
                {!controls.isMac ? (
                    <WindowsTitleBarButtons
                        controlsDisabled={controls.controlsDisabled}
                        canMinimize={controls.canMinimize}
                        canMaximize={controls.canMaximize}
                        isMaximized={controls.isMaximized}
                        onRequestClose={() => {
                            setConfirmClose(true);
                        }}
                        onMinimize={controls.minimizeWindow}
                        onToggleMaximize={controls.toggleMaximizeWindow}
                    />
                ) : null}
            </div>
            <UpdateControlsPanel
                open={showUpdatesPanel}
                onClose={() => {
                    setShowUpdatesPanel(false);
                }}
            />
            <ConfirmDialog
                open={confirmClose}
                title='Close NeonConductor?'
                message='Any active update or runtime operation will continue only if safely supported by the app lifecycle.'
                confirmLabel='Close window'
                cancelLabel='Cancel'
                destructive
                busy={controls.isClosing}
                onCancel={() => {
                    if (controls.isClosing) {
                        return;
                    }
                    setConfirmClose(false);
                }}
                onConfirm={() => {
                    controls.closeWindow();
                }}
            />
        </header>
    );
}
