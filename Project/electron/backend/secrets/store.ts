export interface SecretStore {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
    delete(key: string): Promise<void>;
}

class InMemorySecretStore implements SecretStore {
    private readonly data = new Map<string, string>();

    async get(key: string): Promise<string | null> {
        return this.data.get(key) ?? null;
    }

    async set(key: string, value: string): Promise<void> {
        this.data.set(key, value);
    }

    async delete(key: string): Promise<void> {
        this.data.delete(key);
    }
}

let store: SecretStore = new InMemorySecretStore();

export function getSecretStore(): SecretStore {
    return store;
}

export function initializeSecretStore(nextStore?: SecretStore): SecretStore {
    if (nextStore) {
        store = nextStore;
    }

    return store;
}

