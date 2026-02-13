import { useEffect } from 'react';

import { trpc } from '@/web/trpc/client';

import type { MouseEvent as ReactMouseEvent } from 'react';

export default function TitleBar() {
    const { data: windowState, refetch } = trpc.system.getWindowState.useQuery(undefined, {
        refetchInterval: 800,
    });

    const minimizeMutation = trpc.system.minimizeWindow.useMutation({
        onSuccess: () => {
            void refetch();
        },
    });

    const toggleMaximizeMutation = trpc.system.toggleMaximizeWindow.useMutation({
        onSuccess: () => {
            void refetch();
        },
    });

    const closeMutation = trpc.system.closeWindow.useMutation();
    const showMenuMutation = trpc.system.showWindowMenu.useMutation();
    const showUpdatesMenuMutation = trpc.updates.showMenu.useMutation();
    const closeWindow = closeMutation.mutate;

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
        closeMutation.isPending ||
        showMenuMutation.isPending;
    const menuControlsDisabled = controlsDisabled || showUpdatesMenuMutation.isPending;

    const handleHeaderDoubleClick = (event: ReactMouseEvent<HTMLElement>) => {
        const eventTarget = event.target;
        if (!(eventTarget instanceof Element)) return;
        if (eventTarget.closest('[data-no-drag="true"]')) return;
        if (isMac || isFullScreen || !canMaximize) return;
        toggleMaximizeMutation.mutate();
    };

    const handleHeaderContextMenu = (event: ReactMouseEvent<HTMLElement>) => {
        const eventTarget = event.target;
        if (!(eventTarget instanceof Element)) return;
        if (eventTarget.closest('[data-no-drag="true"]')) return;
        event.preventDefault();
        showMenuMutation.mutate();
    };

    const handleHelpMenuClick = () => {
        showUpdatesMenuMutation.mutate();
    };

    if (isFullScreen) {
        return null;
    }

    const windowButtonBase =
        'inline-flex h-full w-[46px] items-center justify-center border-0 bg-transparent text-white/85 transition-colors hover:bg-white/8 focus-visible:ring-2 focus-visible:ring-[rgba(96,165,250,0.9)] focus-visible:ring-inset focus-visible:outline-none disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent';
    const closeWindowButtonClass = `${windowButtonBase} hover:bg-[#e81123] hover:text-white`;
    const macButtonBase =
        'inline-flex h-3 w-3 items-center justify-center rounded-full border-0 p-0 transition-[filter] hover:brightness-95 disabled:cursor-default disabled:opacity-50';

    return (
        <header
            className='relative z-10 grid h-9 grid-cols-[1fr_auto_1fr] items-center border-b border-white/8 bg-[rgba(10,10,15,0.92)] text-white backdrop-blur-sm select-none [-webkit-app-region:drag]'
            onDoubleClick={handleHeaderDoubleClick}
            onContextMenu={handleHeaderContextMenu}>
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
                                closeMutation.mutate();
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
                    className='h-6 rounded px-2 text-[12px] font-medium text-white/78 transition-colors [-webkit-app-region:no-drag] hover:bg-white/8 hover:text-white focus-visible:ring-2 focus-visible:ring-[rgba(96,165,250,0.9)] focus-visible:outline-none focus-visible:ring-inset disabled:opacity-55'
                    onClick={handleHelpMenuClick}
                    disabled={menuControlsDisabled}>
                    Help
                </button>
            </div>

            <div className='flex h-full min-w-0 items-center justify-center text-center'>
                <span className='pointer-events-none text-[11px] leading-none font-semibold tracking-[0.12em] text-white/75 uppercase'>
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
                            <MinimizeIcon />
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
                            {isMaximized ? <RestoreIcon /> : <MaximizeIcon />}
                        </button>
                        <button
                            type='button'
                            className={closeWindowButtonClass}
                            aria-label='Close window'
                            title='Close'
                            onClick={() => {
                                closeMutation.mutate();
                            }}
                            disabled={controlsDisabled}>
                            <CloseIcon />
                        </button>
                    </div>
                ) : null}
            </div>
        </header>
    );
}

function MinimizeIcon() {
    return (
        <svg
            viewBox='0 0 16 16'
            aria-hidden='true'
            className='h-2.75 w-2.75 fill-none stroke-current stroke-[1.4] [stroke-linecap:round] [stroke-linejoin:round]'>
            <path d='M3 8.5h10' />
        </svg>
    );
}

function MaximizeIcon() {
    return (
        <svg
            viewBox='0 0 16 16'
            aria-hidden='true'
            className='h-2.75 w-2.75 fill-none stroke-current stroke-[1.4] [stroke-linecap:round] [stroke-linejoin:round]'>
            <rect x='3.5' y='3.5' width='9' height='9' />
        </svg>
    );
}

function RestoreIcon() {
    return (
        <svg
            viewBox='0 0 16 16'
            aria-hidden='true'
            className='h-2.75 w-2.75 fill-none stroke-current stroke-[1.4] [stroke-linecap:round] [stroke-linejoin:round]'>
            <rect x='5.5' y='3.5' width='7' height='7' />
            <path d='M10.5 5.5v6h-6' />
            <path d='M3.5 5.5v7h7' />
        </svg>
    );
}

function CloseIcon() {
    return (
        <svg
            viewBox='0 0 16 16'
            aria-hidden='true'
            className='h-2.75 w-2.75 fill-none stroke-current stroke-[1.4] [stroke-linecap:round] [stroke-linejoin:round]'>
            <path d='M4 4l8 8M12 4L4 12' />
        </svg>
    );
}
