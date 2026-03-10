import { useEffect, useRef } from 'react';

import type { ReactNode, RefObject } from 'react';

interface DialogSurfaceProps {
    open: boolean;
    titleId: string;
    descriptionId?: string;
    initialFocusRef?: RefObject<HTMLElement | null>;
    onClose: () => void;
    children: ReactNode;
}

function collectFocusableElements(container: HTMLElement): HTMLElement[] {
    const selector = [
        'button:not([disabled])',
        '[href]',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
    ].join(',');

    return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
        (element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true'
    );
}

export function DialogSurface({
    open,
    titleId,
    descriptionId,
    initialFocusRef,
    onClose,
    children,
}: DialogSurfaceProps) {
    const surfaceRef = useRef<HTMLElement>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (!open) {
            return;
        }

        previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const focusTarget = initialFocusRef?.current ?? surfaceRef.current;
        focusTarget?.focus();

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
                return;
            }

            if (event.key !== 'Tab' || !surfaceRef.current) {
                return;
            }

            const focusableElements = collectFocusableElements(surfaceRef.current);
            if (focusableElements.length === 0) {
                event.preventDefault();
                surfaceRef.current.focus();
                return;
            }

            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];
            if (!firstElement || !lastElement) {
                event.preventDefault();
                surfaceRef.current.focus();
                return;
            }
            const activeElement = document.activeElement;

            if (event.shiftKey && activeElement === firstElement) {
                event.preventDefault();
                lastElement.focus();
                return;
            }

            if (!event.shiftKey && activeElement === lastElement) {
                event.preventDefault();
                firstElement.focus();
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = previousOverflow;
            previousFocusRef.current?.focus();
            previousFocusRef.current = null;
        };
    }, [initialFocusRef, onClose, open]);

    if (!open) {
        return null;
    }

    return (
        <div
            className='bg-background/70 fixed inset-0 z-50 flex items-center justify-center px-4 backdrop-blur-sm'
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                    onClose();
                }
            }}>
            <section
                ref={surfaceRef}
                role='dialog'
                aria-modal='true'
                aria-labelledby={titleId}
                {...(descriptionId ? { 'aria-describedby': descriptionId } : {})}
                tabIndex={-1}
                className='outline-none'>
                {children}
            </section>
        </div>
    );
}
