declare module 'semver' {
    export interface CoercedSemVer {
        major: number;
    }

    export function coerce(version: string): CoercedSemVer | null;
    export function satisfies(version: string, range: string): boolean;
    export function validRange(range: string): string | null;
}
