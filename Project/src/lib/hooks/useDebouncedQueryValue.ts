import { useEffect, useState } from 'react';

export function useDebouncedQueryValue(value: string, delayMs = 200): string {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const timeoutHandle = window.setTimeout(() => {
            setDebouncedValue(value);
        }, delayMs);

        return () => {
            window.clearTimeout(timeoutHandle);
        };
    }, [delayMs, value]);

    return debouncedValue;
}
