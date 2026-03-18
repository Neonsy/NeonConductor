import { beforeEach } from 'vitest';

import { getDefaultProfileId, getPersistence, resetPersistenceForTests } from '@/app/backend/persistence/db';
import {
    accountSnapshotStore,
    checkpointStore,
    conversationStore,
    diffStore,
    marketplaceStore,
    memoryStore,
    mcpStore,
    modeStore,
    permissionStore,
    profileStore,
    providerCatalogStore,
    providerSecretStore,
    providerStore,
    runStore,
    runUsageStore,
    sessionStore,
    skillfileStore,
    tagStore,
    threadStore,
    toolStore,
} from '@/app/backend/persistence/stores';
import { sessionHistoryService } from '@/app/backend/runtime/services/sessionHistory/service';
import { initializeSecretStore } from '@/app/backend/secrets/store';

export function registerPersistenceStoreHooks() {
    beforeEach(() => {
        resetPersistenceForTests();
        initializeSecretStore();
    });
}

export const persistenceStoreProfileId = getDefaultProfileId();

export {
    accountSnapshotStore,
    checkpointStore,
    conversationStore,
    diffStore,
    getDefaultProfileId,
    getPersistence,
    marketplaceStore,
    memoryStore,
    mcpStore,
    modeStore,
    permissionStore,
    profileStore,
    providerCatalogStore,
    providerSecretStore,
    providerStore,
    runStore,
    runUsageStore,
    sessionHistoryService,
    sessionStore,
    skillfileStore,
    tagStore,
    threadStore,
    toolStore,
};
