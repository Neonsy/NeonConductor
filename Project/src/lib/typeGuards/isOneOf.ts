export function isOneOf<const TValue extends readonly string[]>(
    value: string | undefined,
    allowed: TValue
): value is TValue[number] {
    return typeof value === 'string' && allowed.includes(value);
}
