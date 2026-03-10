import { randomUUID } from 'node:crypto';

import type { EntityId, EntityIdPrefix } from '@/shared/contracts/ids';

export function createEntityId<P extends EntityIdPrefix>(prefix: P): EntityId<P> {
    return `${prefix}_${randomUUID()}`;
}
