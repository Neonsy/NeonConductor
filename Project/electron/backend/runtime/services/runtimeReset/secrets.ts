import type { RuntimeResetDatabase } from '@/app/backend/runtime/services/runtimeReset/types';
import { getSecretStore } from '@/app/backend/secrets/store';

function unique(values: string[]): string[] {
    return [...new Set(values)];
}

export async function listSecretKeyRefsByProfile(
    db: RuntimeResetDatabase,
    profileId: string
): Promise<string[]> {
    const rows = await db
        .selectFrom('secret_references')
        .select('secret_key_ref')
        .where('profile_id', '=', profileId)
        .execute();

    return rows.map((row) => row.secret_key_ref);
}

export async function listAllSecretKeyRefs(db: RuntimeResetDatabase): Promise<string[]> {
    const rows = await db.selectFrom('secret_references').select('secret_key_ref').execute();
    return rows.map((row) => row.secret_key_ref);
}

export async function removeSecretsByReferences(secretKeyRefs: string[]): Promise<void> {
    if (secretKeyRefs.length === 0) {
        return;
    }

    const store = getSecretStore();
    await Promise.allSettled(unique(secretKeyRefs).map((secretKeyRef) => store.delete(secretKeyRef)));
}
