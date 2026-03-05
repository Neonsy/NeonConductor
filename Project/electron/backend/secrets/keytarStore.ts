import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const DEFAULT_SERVICE_NAME = 'com.neonsy.neonconductor';

interface KeytarModule {
    getPassword(service: string, account: string): Promise<string | null>;
    setPassword(service: string, account: string, password: string): Promise<void>;
    deletePassword(service: string, account: string): Promise<boolean>;
}

export interface SecretStoreLike {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
    delete(key: string): Promise<void>;
}

export interface SecretStoreInfo {
    backend: 'keytar' | 'memory';
    available: boolean;
    reason?: string;
}

export class SecretStoreUnavailableError extends Error {
    readonly backend: 'keytar';
    readonly reason: string;

    constructor(reason: string) {
        super(`Secret store backend unavailable: ${reason}`);
        this.name = 'SecretStoreUnavailableError';
        this.backend = 'keytar';
        this.reason = reason;
    }
}

class UnavailableSecretStore implements SecretStoreLike {
    constructor(private readonly reason: string) {}

    get(): Promise<string | null> {
        return Promise.reject(new SecretStoreUnavailableError(this.reason));
    }

    set(): Promise<void> {
        return Promise.reject(new SecretStoreUnavailableError(this.reason));
    }

    delete(): Promise<void> {
        return Promise.reject(new SecretStoreUnavailableError(this.reason));
    }
}

class KeytarSecretStore implements SecretStoreLike {
    constructor(
        private readonly keytar: KeytarModule,
        private readonly serviceName: string
    ) {}

    get(key: string): Promise<string | null> {
        return this.keytar.getPassword(this.serviceName, key);
    }

    set(key: string, value: string): Promise<void> {
        return this.keytar.setPassword(this.serviceName, key, value);
    }

    async delete(key: string): Promise<void> {
        await this.keytar.deletePassword(this.serviceName, key);
    }
}

function isKeytarModule(value: unknown): value is KeytarModule {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const getMember = (name: string): unknown => Reflect.get(value, name);
    return (
        typeof getMember('getPassword') === 'function' &&
        typeof getMember('setPassword') === 'function' &&
        typeof getMember('deletePassword') === 'function'
    );
}

function getErrorReason(error: unknown): string {
    if (error instanceof Error && error.message.trim().length > 0) {
        return error.message;
    }

    return 'unknown keytar load failure';
}

export function createKeytarSecretStore(serviceName = DEFAULT_SERVICE_NAME): {
    store: SecretStoreLike;
    info: SecretStoreInfo;
} {
    try {
        const imported: unknown = require('keytar');
        const defaultExport =
            imported && typeof imported === 'object' ? (imported as Record<string, unknown>)['default'] : undefined;
        const moduleValue = isKeytarModule(imported) ? imported : isKeytarModule(defaultExport) ? defaultExport : null;

        if (!moduleValue) {
            return {
                store: new UnavailableSecretStore('keytar module did not expose expected methods'),
                info: {
                    backend: 'keytar',
                    available: false,
                    reason: 'invalid keytar module shape',
                },
            };
        }

        return {
            store: new KeytarSecretStore(moduleValue, serviceName),
            info: {
                backend: 'keytar',
                available: true,
            },
        };
    } catch (error) {
        const reason = getErrorReason(error);
        return {
            store: new UnavailableSecretStore(reason),
            info: {
                backend: 'keytar',
                available: false,
                reason,
            },
        };
    }
}
