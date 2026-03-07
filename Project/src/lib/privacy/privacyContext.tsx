import { createContext, useContext } from 'react';

import type { PrivacyModeState, SensitiveFieldCategory } from '@/web/lib/privacy/privacy';

export interface PrivacyContextValue extends PrivacyModeState {
    setEnabled: (enabled: boolean) => void;
    toggleEnabled: () => void;
    redactValue: (value: string, category: SensitiveFieldCategory) => string;
}

export const PrivacyContext = createContext<PrivacyContextValue | null>(null);

export function usePrivacyMode(): PrivacyContextValue {
    const context = useContext(PrivacyContext);
    if (!context) {
        throw new Error('usePrivacyMode must be used inside PrivacyProvider.');
    }

    return context;
}
