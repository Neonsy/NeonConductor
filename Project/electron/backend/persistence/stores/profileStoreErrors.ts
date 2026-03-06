import { err, ok, type Result } from 'neverthrow';

export interface ProfileStoreError {
    code: 'not_found';
    message: string;
}

export type ProfileStoreResult<T> = Result<T, ProfileStoreError>;

export function okProfileStore<T>(value: T): ProfileStoreResult<T> {
    return ok(value);
}

export function errProfileStore(message: string): ProfileStoreResult<never> {
    return err({
        code: 'not_found',
        message,
    });
}

export function toProfileStoreException(error: ProfileStoreError): Error {
    const exception = new Error(error.message);
    Object.assign(exception, { code: error.code });
    return exception;
}
