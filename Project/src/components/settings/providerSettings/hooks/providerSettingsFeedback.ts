export type ProviderSettingsFeedbackTone = 'error' | 'success' | 'info';

export interface ProviderSettingsFeedbackState {
    message: string | undefined;
    tone: ProviderSettingsFeedbackTone;
}

interface ProviderSettingsMutationErrorSource {
    error?: {
        message?: string;
    } | null;
}

export function buildProviderSettingsFeedback(input: {
    statusMessage: string | undefined;
    mutationErrorSources: ReadonlyArray<ProviderSettingsMutationErrorSource>;
}): ProviderSettingsFeedbackState {
    const firstMutationError = input.mutationErrorSources.find((source) => source.error)?.error?.message;
    if (firstMutationError) {
        return {
            message: firstMutationError,
            tone: 'error',
        };
    }

    if (input.statusMessage) {
        return {
            message: input.statusMessage,
            tone: 'success',
        };
    }

    return {
        message: undefined,
        tone: 'info',
    };
}
