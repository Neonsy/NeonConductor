export function createFailClosedAsyncAction<TArgs extends unknown[]>(
    action: (...args: TArgs) => Promise<void>,
    onError?: (error: unknown) => void
): (...args: TArgs) => Promise<void> {
    return async (...args: TArgs): Promise<void> => {
        try {
            await action(...args);
        } catch (error) {
            onError?.(error);
        }
    };
}
