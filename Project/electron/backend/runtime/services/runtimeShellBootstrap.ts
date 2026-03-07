import { runtimeEventStore, tagStore, workspaceRootStore } from '@/app/backend/persistence/stores';
import { providerManagementService } from '@/app/backend/providers/service';
import type { RuntimeShellBootstrap } from '@/app/backend/runtime/contracts';
import { getExecutionPreset } from '@/app/backend/runtime/services/profile/executionPreset';

export interface RuntimeShellBootstrapService {
    getShellBootstrap(profileId: string): Promise<RuntimeShellBootstrap>;
}

class RuntimeShellBootstrapServiceImpl implements RuntimeShellBootstrapService {
    async getShellBootstrap(profileId: string): Promise<RuntimeShellBootstrap> {
        const [lastSequence, providers, providerModels, defaults, threadTags, executionPreset, workspaceRoots] =
            await Promise.all([
            runtimeEventStore.getLastSequence(),
            providerManagementService.listProviders(profileId),
            providerManagementService.listModelsByProfile(profileId),
            providerManagementService.getDefaults(profileId),
            tagStore.listThreadTagsByProfile(profileId),
            getExecutionPreset(profileId),
            workspaceRootStore.listByProfile(profileId),
        ]);

        return {
            lastSequence,
            providers,
            providerModels,
            defaults,
            threadTags,
            executionPreset,
            workspaceRoots,
        };
    }
}

export const runtimeShellBootstrapService: RuntimeShellBootstrapService = new RuntimeShellBootstrapServiceImpl();
