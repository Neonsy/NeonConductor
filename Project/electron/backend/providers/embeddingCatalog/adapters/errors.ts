import { err, ok, type Result } from 'neverthrow';

export type EmbeddingCatalogAdapterErrorCode =
    | 'auth_missing'
    | 'invalid_payload'
    | 'provider_request_failed'
    | 'provider_request_unavailable';

export interface EmbeddingCatalogAdapterError {
    code: EmbeddingCatalogAdapterErrorCode;
    message: string;
}

export type EmbeddingCatalogAdapterResult<T> = Result<T, EmbeddingCatalogAdapterError>;

export function okEmbeddingCatalogAdapter<T>(value: T): EmbeddingCatalogAdapterResult<T> {
    return ok(value);
}

export function errEmbeddingCatalogAdapter(
    code: EmbeddingCatalogAdapterErrorCode,
    message: string
): EmbeddingCatalogAdapterResult<never> {
    return err({
        code,
        message,
    });
}
