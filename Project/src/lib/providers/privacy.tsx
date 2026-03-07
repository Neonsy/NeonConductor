import { useEffect, useMemo, useState } from 'react';

import {
    applyPrivacyMode,
    persistPrivacyMode,
    readStoredPrivacyMode,
    redactSensitiveValue,
} from '@/web/lib/privacy/privacy';
import { PrivacyContext } from '@/web/lib/privacy/privacyContext';
import type { PrivacyContextValue } from '@/web/lib/privacy/privacyContext';

import type { ReactNode } from 'react';

export function PrivacyProvider({ children }: { children: ReactNode }): ReactNode {
    const [enabled, setEnabled] = useState<boolean>(() => readStoredPrivacyMode().enabled);

    useEffect(() => {
        const state = { enabled };
        applyPrivacyMode(state);
        persistPrivacyMode(state);
    }, [enabled]);

    const value = useMemo<PrivacyContextValue>(
        () => ({
            enabled,
            setEnabled,
            toggleEnabled: () => {
                setEnabled((current) => !current);
            },
            redactValue: (value, category) => redactSensitiveValue(value, category),
        }),
        [enabled]
    );

    return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>;
}
