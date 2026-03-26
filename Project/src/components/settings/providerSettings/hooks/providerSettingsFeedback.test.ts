import { describe, expect, it } from 'vitest';

import { buildProviderSettingsFeedback } from '@/web/components/settings/providerSettings/hooks/providerSettingsFeedback';

describe('provider settings feedback', () => {
    it('treats mutation errors as authoritative over stale success messages', () => {
        const feedback = buildProviderSettingsFeedback({
            statusMessage: 'Default provider/model updated.',
            mutationErrorSources: [{ error: { message: 'Catalog sync failed.' } }],
        });

        expect(feedback).toEqual({
            message: 'Catalog sync failed.',
            tone: 'error',
        });
    });

    it('treats status messages as successful action feedback when no mutation failed', () => {
        const feedback = buildProviderSettingsFeedback({
            statusMessage: 'Connection profile updated.',
            mutationErrorSources: [{ error: null }],
        });

        expect(feedback).toEqual({
            message: 'Connection profile updated.',
            tone: 'success',
        });
    });
});
