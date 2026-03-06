export function nowIso(): string {
    return new Date().toISOString();
}

export type JsonValueGuard<T> = (value: unknown) => value is T;

export function isJsonRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isJsonString(value: unknown): value is string {
    return typeof value === 'string';
}

export function isJsonUnknownArray(value: unknown): value is unknown[] {
    return Array.isArray(value);
}

export function parseJsonValue<T>(input: string, fallback: T, isValid: JsonValueGuard<T>): T {
    try {
        const parsed: unknown = JSON.parse(input);
        return isValid(parsed) ? parsed : fallback;
    } catch {
        return fallback;
    }
}
