import { Copy, Minus, Square, X } from 'lucide-react';

interface MacTitleBarButtonsProps {
    controlsDisabled: boolean;
    canMinimize: boolean;
    canMaximize: boolean;
    isMaximized: boolean;
    onRequestClose: () => void;
    onMinimize: () => void;
    onToggleMaximize: () => void;
}

interface WindowsTitleBarButtonsProps {
    controlsDisabled: boolean;
    canMinimize: boolean;
    canMaximize: boolean;
    isMaximized: boolean;
    onRequestClose: () => void;
    onMinimize: () => void;
    onToggleMaximize: () => void;
}

const WINDOW_BUTTON_BASE =
    'inline-flex h-full w-[46px] items-center justify-center border-0 bg-transparent text-foreground/70 transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent';
const CLOSE_WINDOW_BUTTON_CLASS = `${WINDOW_BUTTON_BASE} hover:bg-destructive/85 hover:text-destructive-foreground`;
const MAC_BUTTON_BASE =
    'inline-flex h-3 w-3 items-center justify-center rounded-full border-0 p-0 transition-[filter] hover:brightness-95 disabled:cursor-default disabled:opacity-50';

export function MacTitleBarButtons({
    controlsDisabled,
    canMinimize,
    canMaximize,
    isMaximized,
    onRequestClose,
    onMinimize,
    onToggleMaximize,
}: MacTitleBarButtonsProps) {
    return (
        <div data-no-drag='true' className='inline-flex h-full items-center gap-2 [-webkit-app-region:no-drag]'>
            <button
                type='button'
                className={`${MAC_BUTTON_BASE} bg-[#ff5f57]`}
                aria-label='Close window'
                title='Close'
                onClick={onRequestClose}
                disabled={controlsDisabled}
            />
            <button
                type='button'
                className={`${MAC_BUTTON_BASE} bg-[#febc2e]`}
                aria-label='Minimize window'
                title='Minimize'
                onClick={onMinimize}
                disabled={controlsDisabled || !canMinimize}
            />
            <button
                type='button'
                className={`${MAC_BUTTON_BASE} bg-[#28c840]`}
                aria-label={isMaximized ? 'Restore window' : 'Maximize window'}
                title={isMaximized ? 'Restore' : 'Maximize'}
                onClick={onToggleMaximize}
                disabled={controlsDisabled || !canMaximize}
            />
        </div>
    );
}

export function WindowsTitleBarButtons({
    controlsDisabled,
    canMinimize,
    canMaximize,
    isMaximized,
    onRequestClose,
    onMinimize,
    onToggleMaximize,
}: WindowsTitleBarButtonsProps) {
    return (
        <div data-no-drag='true' className='inline-flex h-full items-center [-webkit-app-region:no-drag]'>
            <button
                type='button'
                className={WINDOW_BUTTON_BASE}
                aria-label='Minimize window'
                title='Minimize'
                onClick={onMinimize}
                disabled={controlsDisabled || !canMinimize}>
                <Minus className='h-3.5 w-3.5' />
            </button>
            <button
                type='button'
                className={WINDOW_BUTTON_BASE}
                aria-label={isMaximized ? 'Restore window' : 'Maximize window'}
                title={isMaximized ? 'Restore' : 'Maximize'}
                onClick={onToggleMaximize}
                disabled={controlsDisabled || !canMaximize}>
                {isMaximized ? <Copy className='h-3.5 w-3.5' /> : <Square className='h-3.5 w-3.5' />}
            </button>
            <button
                type='button'
                className={CLOSE_WINDOW_BUTTON_CLASS}
                aria-label='Close window'
                title='Close'
                onClick={onRequestClose}
                disabled={controlsDisabled}>
                <X className='h-3.5 w-3.5' />
            </button>
        </div>
    );
}
