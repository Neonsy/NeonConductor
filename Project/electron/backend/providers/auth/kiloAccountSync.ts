import { accountSnapshotStore, providerStore } from '@/app/backend/persistence/stores';
import { kiloGatewayClient } from '@/app/backend/providers/kiloGatewayClient';

export async function syncKiloAccountContext(input: {
    profileId: string;
    accessToken: string;
    organizationId?: string;
    tokenExpiresAt?: string;
}): Promise<void> {
    const headers = {
        accessToken: input.accessToken,
        ...(input.organizationId ? { organizationId: input.organizationId } : {}),
    };

    const [profile, defaults, balance] = await Promise.all([
        kiloGatewayClient.getProfile(headers),
        input.organizationId
            ? kiloGatewayClient.getOrganizationDefaults(input.organizationId, headers)
            : kiloGatewayClient.getDefaults(headers),
        kiloGatewayClient.getProfileBalance(headers).catch(() => undefined),
    ]);

    await accountSnapshotStore.upsertAccount({
        profileId: input.profileId,
        ...(profile.accountId ? { accountId: profile.accountId } : {}),
        displayName: profile.displayName,
        emailMasked: profile.emailMasked,
        authState: 'authenticated',
        ...(input.tokenExpiresAt ? { tokenExpiresAt: input.tokenExpiresAt } : {}),
        ...(balance
            ? {
                  balance: {
                      amount: balance.balance,
                      currency: balance.currency,
                      updatedAt: new Date().toISOString(),
                  },
              }
            : {}),
    });
    await accountSnapshotStore.replaceOrganizations({
        profileId: input.profileId,
        organizations: profile.organizations,
    });

    if (defaults.defaultModelId) {
        const modelExists = await providerStore.modelExists(input.profileId, 'kilo', defaults.defaultModelId);
        if (modelExists) {
            await providerStore.setDefaults(input.profileId, 'kilo', defaults.defaultModelId);
        }
    }
}
