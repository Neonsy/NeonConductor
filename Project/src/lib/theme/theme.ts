export type ThemePreference = 'auto' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'neonconductor.theme.preference';

function isThemePreference(value: string): value is ThemePreference {
    return value === 'auto' || value === 'light' || value === 'dark';
}

export function getSystemTheme(): ResolvedTheme {
    if (typeof window === 'undefined') {
        return 'dark';
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
    if (preference === 'auto') {
        return getSystemTheme();
    }

    return preference;
}

export function applyResolvedTheme(theme: ResolvedTheme): void {
    if (typeof document === 'undefined') {
        return;
    }

    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.dataset['theme'] = theme;
}

export function readStoredPreference(): ThemePreference | null {
    if (typeof window === 'undefined') {
        return null;
    }

    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (!value || !isThemePreference(value)) {
        return null;
    }

    return value;
}

export function persistPreference(preference: ThemePreference): void {
    if (typeof window === 'undefined') {
        return;
    }

    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
}

export function initializeThemeClass(): void {
    const stored = readStoredPreference();
    const preference = stored ?? 'auto';
    applyResolvedTheme(resolveTheme(preference));
}
