import { err, ok, type Result } from 'neverthrow';

export interface ModeResolutionError {
    code: 'mode_not_available';
    message: string;
}

export type ModeResolutionResult<T> = Result<T, ModeResolutionError>;

export function okModeResolution<T>(value: T): ModeResolutionResult<T> {
    return ok(value);
}

export function errModeResolution(message: string): ModeResolutionResult<never> {
    return err({
        code: 'mode_not_available',
        message,
    });
}
