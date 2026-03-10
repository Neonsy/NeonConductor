import { describe, expect, it, vi } from 'vitest';

import { prefetchUpdateControlsData } from '@/web/components/window/updateControlsPrefetch';

describe('updateControlsPrefetch', () => {
    it('warms update channel and switch status before the panel opens', async () => {
        const getChannelPrefetch = vi.fn().mockResolvedValue(undefined);
        const getSwitchStatusPrefetch = vi.fn().mockResolvedValue(undefined);

        prefetchUpdateControlsData({
            trpcUtils: {
                updates: {
                    getChannel: {
                        prefetch: getChannelPrefetch,
                    },
                    getSwitchStatus: {
                        prefetch: getSwitchStatusPrefetch,
                    },
                },
            },
        });

        await Promise.resolve();

        expect(getChannelPrefetch).toHaveBeenCalledOnce();
        expect(getSwitchStatusPrefetch).toHaveBeenCalledOnce();
    });
});
