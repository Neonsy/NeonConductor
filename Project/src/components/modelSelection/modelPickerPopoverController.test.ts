import { afterEach, describe, expect, it } from 'vitest';

import {
    initialModelPickerPopoverState,
    modelPickerPopoverReducer,
    resolvePopoverLayout,
} from '@/web/components/modelSelection/useModelPickerPopoverController';

function setWindowSize(innerWidth: number, innerHeight: number): void {
    Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: {
            innerWidth,
            innerHeight,
        },
    });
}

afterEach(() => {
    delete (globalThis as typeof globalThis & { window?: unknown }).window;
});

describe('model picker popover controller', () => {
    it('transitions state through the reducer actions', () => {
        let state = initialModelPickerPopoverState;

        state = modelPickerPopoverReducer(state, { type: 'open' });
        expect(state.isOpen).toBe(true);

        state = modelPickerPopoverReducer(state, { type: 'set-query', query: 'claude' });
        expect(state.query).toBe('claude');

        state = modelPickerPopoverReducer(state, {
            type: 'set-layout',
            layout: {
                top: 12,
                left: 18,
                width: 320,
                maxHeight: 280,
            },
        });
        expect(state.popoverLayout).toEqual({
            top: 12,
            left: 18,
            width: 320,
            maxHeight: 280,
        });

        state = modelPickerPopoverReducer(state, { type: 'toggle' });
        expect(state.isOpen).toBe(false);

        state = modelPickerPopoverReducer(state, { type: 'close' });
        expect(state.isOpen).toBe(false);
    });

    it('positions the popover below the trigger when there is room', () => {
        setWindowSize(1280, 900);

        const layout = resolvePopoverLayout({
            left: 180,
            top: 120,
            bottom: 160,
            width: 360,
            height: 40,
        } as DOMRect);

        expect(layout.left).toBeGreaterThanOrEqual(16);
        expect(layout.width).toBeGreaterThanOrEqual(360);
        expect(layout.top).toBeGreaterThan(160);
        expect(layout.maxHeight).toBeGreaterThan(0);
    });

    it('opens above the trigger when space below is constrained', () => {
        setWindowSize(900, 520);

        const layout = resolvePopoverLayout({
            left: 680,
            top: 380,
            bottom: 420,
            width: 220,
            height: 40,
        } as DOMRect);

        expect(layout.top).toBeLessThan(380);
        expect(layout.maxHeight).toBeGreaterThanOrEqual(220);
        expect(layout.left).toBeGreaterThanOrEqual(16);
    });
});
