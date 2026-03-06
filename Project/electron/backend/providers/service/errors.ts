import { err, ok, type Result } from 'neverthrow';

export type ProviderServiceErrorCode =
    | 'provider_not_supported'
    | 'provider_not_registered'
    | 'provider_model_missing'
    | 'invalid_payload'
    | 'request_failed'
    | 'request_unavailable';

export interface ProviderServiceError {
    code: ProviderServiceErrorCode;
    message: string;
}

export type ProviderServiceResult<T> = Result<T, ProviderServiceError>;

export function okProviderService<T>(value: T): ProviderServiceResult<T> {
    return ok(value);
}

export function errProviderService(code: ProviderServiceErrorCode, message: string): ProviderServiceResult<never> {
    return err({
        code,
        message,
    });
}

export function toProviderServiceException(error: ProviderServiceError): Error {
    const exception = new Error(error.message);
    (exception as { code?: string }).code = error.code;
    return exception;
}
