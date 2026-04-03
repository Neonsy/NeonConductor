import { isOneOf } from '@/web/lib/typeGuards/isOneOf';

import { providerIds, type RuntimeProviderId } from '@/shared/contracts';

export function readRuntimeProviderId(value: string | undefined): RuntimeProviderId | undefined {
    return isOneOf(value, providerIds) ? value : undefined;
}
