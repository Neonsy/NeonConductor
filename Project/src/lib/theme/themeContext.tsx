import { createContext, useContext } from 'react';

import type { ResolvedTheme, ThemePreference } from '@/web/lib/theme/theme';

export interface ThemeContextValue {
    preference: ThemePreference;
    resolvedTheme: ResolvedTheme;
    setPreference: (preference: ThemePreference) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used inside ThemeProvider.');
    }

    return context;
}
