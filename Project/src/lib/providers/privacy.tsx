import { useEffect, useState } from 'react';

import {
    applyPrivacyMode,
    persistPrivacyMode,
    readStoredPrivacyMode,
    redactSensitiveValue,
} from '@/web/lib/privacy/privacy';
import { PrivacyContext } from '@/web/lib/privacy/privacyContext';

import type { ReactNode } from 'react';

export function PrivacyProvider({ children }: { children: ReactNode }): ReactNode {
    const [enabled, setEnabled] = useState<boolean>(() => readStoredPrivacyMode().enabled);

    useEffect(() => {
        const state = { enabled };
        applyPrivacyMode(state);
        persistPrivacyMode(state);
    }, [enabled]);

    return (
        <PrivacyContext.Provider
            value={{
                enabled,
                setEnabled,
                toggleEnabled: () => {
                    setEnabled((current) => !current);
                },
                redactValue: (value, category) => redactSensitiveValue(value, category),
            }}>
            {children}
        </PrivacyContext.Provider>
    );
}
