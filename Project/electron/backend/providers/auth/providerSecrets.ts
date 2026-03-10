import type { ProviderSecretKind } from '@/app/backend/runtime/contracts';
import type { RuntimeProviderId } from '@/app/backend/runtime/contracts';
import { getSecretStore } from '@/app/backend/secrets/store';

export async function writeProviderSecretValue(input: {
    profileId: string;
    providerId: RuntimeProviderId;
    secretKind: ProviderSecretKind;
    value: string;
}): Promise<void> {
    await getSecretStore().setValue({
        profileId: input.profileId,
        providerId: input.providerId,
        secretKind: input.secretKind,
        secretValue: input.value,
    });
}

export async function readProviderSecretValue(
    profileId: string,
    providerId: RuntimeProviderId,
    secretKind: ProviderSecretKind
): Promise<string | undefined> {
    const value = await getSecretStore().getValue(profileId, providerId, secretKind);
    return value ?? undefined;
}
