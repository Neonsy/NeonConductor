export function launchBackgroundTask(run: () => Promise<unknown>, onError?: (error: unknown) => void): void {
    run().catch((error: unknown) => {
        onError?.(error);
    });
}
