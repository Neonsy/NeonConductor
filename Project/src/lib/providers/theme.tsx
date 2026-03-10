import { useEffect, useState } from 'react';

import {
    applyResolvedTheme,
    getSystemTheme,
    persistPreference,
    readStoredPreference,
    resolveTheme,
} from '@/web/lib/theme/theme';
import type { ResolvedTheme, ThemePreference } from '@/web/lib/theme/theme';
import { ThemeContext } from '@/web/lib/theme/themeContext';

import type { ReactNode } from 'react';

export function ThemeProvider({ children }: { children: ReactNode }): ReactNode {
    const [preference, setPreferenceState] = useState<ThemePreference>(() => readStoredPreference() ?? 'auto');
    const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(preference));

    useEffect(() => {
        const nextResolved = resolveTheme(preference);
        setResolvedTheme(nextResolved);
        applyResolvedTheme(nextResolved);
        persistPreference(preference);
    }, [preference]);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        if (preference !== 'auto') {
            return;
        }

        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const onChange = () => {
            const nextResolved = getSystemTheme();
            setResolvedTheme(nextResolved);
            applyResolvedTheme(nextResolved);
        };

        media.addEventListener('change', onChange);
        return () => {
            media.removeEventListener('change', onChange);
        };
    }, [preference]);

    return (
        <ThemeContext.Provider
            value={{
                preference,
                resolvedTheme,
                setPreference: setPreferenceState,
            }}>
            {children}
        </ThemeContext.Provider>
    );
}
