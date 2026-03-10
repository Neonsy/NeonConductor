export const SPLASH_PHASE_CHANNEL = 'neonconductor:splash-phase';

export const SPLASH_PHASE_VALUES = ['starting', 'delayed'] as const;

export type SplashPhase = (typeof SPLASH_PHASE_VALUES)[number];

export function isSplashPhase(value: unknown): value is SplashPhase {
    return typeof value === 'string' && SPLASH_PHASE_VALUES.some((phase) => phase === value);
}
