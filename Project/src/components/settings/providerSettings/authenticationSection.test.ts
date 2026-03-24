import { describe, expect, it } from 'vitest';

import {
    buildProviderAuthenticationDraftKey,
    shouldHydrateKiloStoredCredential,
} from '@/web/components/settings/providerSettings/authenticationSection';

describe('provider authentication draft helpers', () => {
    it('builds a fresh draft key from provider, connection profile, and base URL override identity', () => {
        expect(
            buildProviderAuthenticationDraftKey({
                selectedProviderId: 'openai',
                connectionProfileValue: 'default',
                baseUrlOverrideValue: 'https://api.openai.com/v1',
            })
        ).toBe('openai:default:https://api.openai.com/v1');
    });

    it('hydrates the stored Kilo credential only when the draft is still empty', () => {
        expect(
            shouldHydrateKiloStoredCredential({
                selectedProviderId: 'kilo',
                credentialSource: 'access_token',
                hasLoadedStoredCredential: false,
                apiKeyInput: '',
            })
        ).toBe(true);

        expect(
            shouldHydrateKiloStoredCredential({
                selectedProviderId: 'kilo',
                credentialSource: 'access_token',
                hasLoadedStoredCredential: false,
                apiKeyInput: 'manual-user-entry',
            })
        ).toBe(false);
    });
});
