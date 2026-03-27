import { useEffect, useId, useRef, useState } from 'react';
import type { RefObject } from 'react';

import type { PopoverLayout } from '@/web/components/modelSelection/modelPicker.types';

export function resolvePopoverLayout(triggerRect: DOMRect): PopoverLayout {
    const viewportPadding = 16;
    const minimumWidth = Math.min(420, window.innerWidth - viewportPadding * 2);
    const availableWidth = window.innerWidth - viewportPadding * 2;
    const width = Math.min(Math.max(triggerRect.width, minimumWidth), availableWidth);
    const maxLeft = window.innerWidth - viewportPadding - width;
    const left = Math.max(viewportPadding, Math.min(triggerRect.left, maxLeft));
    const availableBelow = window.innerHeight - triggerRect.bottom - viewportPadding;
    const availableAbove = triggerRect.top - viewportPadding;
    const shouldOpenAbove = availableBelow < 280 && availableAbove > availableBelow;
    const maxHeight = Math.max(220, Math.min(420, shouldOpenAbove ? availableAbove - 12 : availableBelow - 12));
    const top = shouldOpenAbove
        ? Math.max(viewportPadding, triggerRect.top - maxHeight - 8)
        : Math.min(triggerRect.bottom + 8, window.innerHeight - viewportPadding - maxHeight);

    return {
        top,
        left,
        width,
        maxHeight,
    };
}

export interface ModelPickerPopoverState {
    isOpen: boolean;
    query: string;
    popoverLayout: PopoverLayout | null;
}

export type ModelPickerPopoverAction =
    | {
          type: 'open';
      }
    | {
          type: 'close';
      }
    | {
          type: 'toggle';
      }
    | {
          type: 'set-query';
          query: string;
      }
    | {
          type: 'set-layout';
          layout: PopoverLayout | null;
      };

export const initialModelPickerPopoverState: ModelPickerPopoverState = {
    isOpen: false,
    query: '',
    popoverLayout: null,
};

export function modelPickerPopoverReducer(
    state: ModelPickerPopoverState,
    action: ModelPickerPopoverAction
): ModelPickerPopoverState {
    switch (action.type) {
        case 'open':
            return {
                ...state,
                isOpen: true,
            };
        case 'close':
            return {
                ...state,
                isOpen: false,
                query: '',
                popoverLayout: null,
            };
        case 'toggle':
            return {
                ...state,
                isOpen: !state.isOpen,
            };
        case 'set-query':
            return {
                ...state,
                query: action.query,
            };
        case 'set-layout':
            return {
                ...state,
                popoverLayout: action.layout,
            };
    }
}

export interface ModelPickerPopoverController {
    isOpen: boolean;
    query: string;
    listboxId: string;
    popoverLayout: PopoverLayout | null;
    containerRef: RefObject<HTMLDivElement | null>;
    panelRef: RefObject<HTMLDivElement | null>;
    searchInputRef: RefObject<HTMLInputElement | null>;
    openPopover: () => void;
    closePopover: () => void;
    togglePopover: () => void;
    setQuery: (query: string) => void;
}

export function useModelPickerPopoverController(props: { disabled?: boolean } = {}) {
    const [open, setOpen] = useState(false);
    const [query, setQueryState] = useState('');
    const [popoverLayout, setPopoverLayout] = useState<PopoverLayout | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const panelRef = useRef<HTMLDivElement | null>(null);
    const searchInputRef = useRef<HTMLInputElement | null>(null);
    const listboxId = useId();

    useEffect(() => {
        if (!open) {
            setQueryState('');
            setPopoverLayout(null);
            return;
        }

        const updateLayout = () => {
            const triggerElement = containerRef.current;
            if (!triggerElement) {
                return;
            }

            setPopoverLayout(resolvePopoverLayout(triggerElement.getBoundingClientRect()));
        };

        updateLayout();
        requestAnimationFrame(() => {
            searchInputRef.current?.focus();
        });

        const handlePointerDown = (event: MouseEvent) => {
            const targetNode = event.target;
            if (!(targetNode instanceof Node)) {
                return;
            }
            if (!containerRef.current?.contains(targetNode) && !panelRef.current?.contains(targetNode)) {
                setOpen(false);
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setOpen(false);
            }
        };

        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        window.addEventListener('resize', updateLayout);
        window.addEventListener('scroll', updateLayout, true);
        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('resize', updateLayout);
            window.removeEventListener('scroll', updateLayout, true);
        };
    }, [open]);

    return {
        isOpen: open,
        query,
        popoverLayout,
        containerRef,
        panelRef,
        searchInputRef,
        listboxId,
        openPopover() {
            if (props.disabled) {
                return;
            }

            setOpen(true);
        },
        closePopover() {
            setOpen(false);
        },
        togglePopover() {
            if (props.disabled) {
                return;
            }

            setOpen((current) => !current);
        },
        setQuery(value: string) {
            setQueryState(value);
        },
    };
}
