import { Copy, Minus, Square, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { ConfirmDialog } from '@/web/components/ui/confirmDialog';
import ThemeToggle from '@/web/components/window/themeToggle';
import { UpdateControlsPanel } from '@/web/components/window/updateControlsPanel';
import { useWindowStateStreamStore } from '@/web/lib/window/stateStream';
import { trpc } from '@/web/trpc/client';

import type { MouseEvent as ReactMouseEvent } from 'react';

export default function TitleBar() {
    const windowState = useWindowStateStreamStore((state) => state.windowState);
    const [showUpdatesPanel, setShowUpdatesPanel] = useState(false);
    const [confirmClose, setConfirmClose] = useState(false);

    const minimizeMutation = trpc.system.minimizeWindow.useMutation();

    const toggleMaximizeMutation = trpc.system.toggleMaximizeWindow.useMutation();

    const closeMutation = trpc.system.closeWindow.useMutation();
    const closeWindow = () => closeMutation.mutate();

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.repeat) return;

            const isMac = windowState?.platform === 'darwin';
            const isCloseWindowShortcut = isMac
                ? event.metaKey && !event.ctrlKey && !event.altKey && event.code === 'KeyW'
                : event.ctrlKey && event.shiftKey && !event.altKey && event.code === 'KeyW';

            if (isCloseWindowShortcut) {
                event.preventDefault();
                closeWindow();
            }
        };

        window.addEventListener('keydown', onKeyDown);

        return () => {
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [closeWindow, windowState?.platform]);

    const platform = windowState?.platform ?? 'win32';
    const isMac = platform === 'darwin';
    const isMaximized = Boolean(windowState?.isMaximized);
    const isFullScreen = Boolean(windowState?.isFullScreen);
    const canMaximize = Boolean(windowState?.canMaximize);
    const canMinimize = Boolean(windowState?.canMinimize);
    const controlsDisabled =
        minimizeMutation.isPending ||
        toggleMaximizeMutation.isPending ||
        closeMutation.isPending;
    const menuControlsDisabled = controlsDisabled;

    const handleHeaderDoubleClick = (event: ReactMouseEvent<HTMLElement>) => {
        const eventTarget = event.target;
        if (!(eventTarget instanceof Element)) return;
        if (eventTarget.closest('[data-no-drag="true"]')) return;
        if (isMac || isFullScreen || !canMaximize) return;
        toggleMaximizeMutation.mutate();
    };

    const handleHelpMenuClick = () => {
        setShowUpdatesPanel((current) => !current);
    };

    if (isFullScreen) {
        return null;
    }

    const windowButtonBase =
        'inline-flex h-full w-[46px] items-center justify-center border-0 bg-transparent text-foreground/70 transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent';
    const closeWindowButtonClass = `${windowButtonBase} hover:bg-destructive/85 hover:text-destructive-foreground`;
    const macButtonBase =
        'inline-flex h-3 w-3 items-center justify-center rounded-full border-0 p-0 transition-[filter] hover:brightness-95 disabled:cursor-default disabled:opacity-50';

    return (
        <header
            className='border-border bg-background/95 text-foreground relative z-10 grid h-9 grid-cols-[1fr_auto_1fr] items-center border-b backdrop-blur-sm select-none [-webkit-app-region:drag]'
            onDoubleClick={handleHeaderDoubleClick}>
            <div className='flex h-full min-w-0 items-center justify-start gap-2 pl-2.5'>
                {isMac ? (
                    <div
                        data-no-drag='true'
                        className='inline-flex h-full items-center gap-2 [-webkit-app-region:no-drag]'>
                        <button
                            type='button'
                            className={`${macButtonBase} bg-[#ff5f57]`}
                            aria-label='Close window'
                            title='Close'
                            onClick={() => {
                                setConfirmClose(true);
                            }}
                            disabled={controlsDisabled}
                        />
                        <button
                            type='button'
                            className={`${macButtonBase} bg-[#febc2e]`}
                            aria-label='Minimize window'
                            title='Minimize'
                            onClick={() => {
                                minimizeMutation.mutate();
                            }}
                            disabled={controlsDisabled || !canMinimize}
                        />
                        <button
                            type='button'
                            className={`${macButtonBase} bg-[#28c840]`}
                            aria-label={isMaximized ? 'Restore window' : 'Maximize window'}
                            title={isMaximized ? 'Restore' : 'Maximize'}
                            onClick={() => {
                                toggleMaximizeMutation.mutate();
                            }}
                            disabled={controlsDisabled || !canMaximize}
                        />
                    </div>
                ) : null}

                <button
                    type='button'
                    data-no-drag='true'
                    className='text-foreground/75 hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring h-7 rounded-md px-2 text-[12px] font-medium transition-colors [-webkit-app-region:no-drag] focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset disabled:opacity-55'
                    onClick={handleHelpMenuClick}
                    disabled={menuControlsDisabled}>
                    Help
                </button>
                <ThemeToggle />
            </div>

            <div className='flex h-full min-w-0 items-center justify-center text-center'>
                <span className='text-foreground/70 pointer-events-none text-[11px] leading-none font-semibold tracking-[0.12em] uppercase'>
                    NEONCONDUCTOR
                </span>
            </div>

            <div className='flex h-full min-w-0 items-center justify-end'>
                {!isMac ? (
                    <div data-no-drag='true' className='inline-flex h-full items-center [-webkit-app-region:no-drag]'>
                        <button
                            type='button'
                            className={windowButtonBase}
                            aria-label='Minimize window'
                            title='Minimize'
                            onClick={() => {
                                minimizeMutation.mutate();
                            }}
                            disabled={controlsDisabled || !canMinimize}>
                            <Minus className='h-3.5 w-3.5' />
                        </button>
                        <button
                            type='button'
                            className={windowButtonBase}
                            aria-label={isMaximized ? 'Restore window' : 'Maximize window'}
                            title={isMaximized ? 'Restore' : 'Maximize'}
                            onClick={() => {
                                toggleMaximizeMutation.mutate();
                            }}
                            disabled={controlsDisabled || !canMaximize}>
                            {isMaximized ? <Copy className='h-3.5 w-3.5' /> : <Square className='h-3.5 w-3.5' />}
                        </button>
                        <button
                            type='button'
                            className={closeWindowButtonClass}
                            aria-label='Close window'
                            title='Close'
                            onClick={() => {
                                setConfirmClose(true);
                            }}
                            disabled={controlsDisabled}>
                            <X className='h-3.5 w-3.5' />
                        </button>
                    </div>
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
                busy={closeMutation.isPending}
                onCancel={() => {
                    if (closeMutation.isPending) {
                        return;
                    }
                    setConfirmClose(false);
                }}
                onConfirm={() => {
                    closeWindow();
                }}
            />
        </header>
    );
}
