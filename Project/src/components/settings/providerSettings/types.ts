import type { ProviderModelRecord } from '@/app/backend/persistence/types';
import type { RuntimeProviderId } from '@/app/backend/runtime/contracts';

export interface ActiveAuthFlow {
    providerId: RuntimeProviderId;
    flowId: string;
    userCode?: string;
    verificationUri?: string;
    pollAfterSeconds: number;
}

export interface ProviderListItem {
    id: RuntimeProviderId;
    label: string;
    isDefault: boolean;
    authState: string;
    authMethod: string;
}

export interface ProviderAuthStateView {
    authState: string;
    authMethod: string;
}

export type ProviderModelOption = ProviderModelRecord;
