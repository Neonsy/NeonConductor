import { describe, expect, it } from 'vitest';

import { formatRoutingBadge } from '@/web/components/conversation/routingBadge';

describe('formatRoutingBadge', () => {
    it('formats pinned and dynamic routing labels for kilo models', () => {
        expect(
            formatRoutingBadge('kilo', {
                routingMode: 'pinned',
                pinnedProviderId: 'openai',
            })
        ).toBe('Routing: Pinned (openai)');

        expect(
            formatRoutingBadge('kilo', {
                routingMode: 'dynamic',
                sort: 'throughput',
            })
        ).toBe('Routing: Dynamic (Highest Throughput)');
    });

    it('returns no badge for non-kilo providers', () => {
        expect(
            formatRoutingBadge('openai', {
                routingMode: 'dynamic',
                sort: 'price',
            })
        ).toBeUndefined();
    });
});
