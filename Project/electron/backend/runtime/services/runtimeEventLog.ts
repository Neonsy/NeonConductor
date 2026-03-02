import { runtimeEventStore } from '@/app/backend/persistence/stores';

import type { RuntimeEventRecordV1 } from '@/app/backend/persistence/types';

export interface RuntimeEventLogService {
    append(event: {
        entityType: string;
        entityId: string;
        eventType: string;
        payload: Record<string, unknown>;
    }): Promise<RuntimeEventRecordV1>;
    getEvents(afterSequence: number | null, limit: number): Promise<RuntimeEventRecordV1[]>;
}

class RuntimeEventLogServiceImpl implements RuntimeEventLogService {
    append(event: {
        entityType: string;
        entityId: string;
        eventType: string;
        payload: Record<string, unknown>;
    }): Promise<RuntimeEventRecordV1> {
        return runtimeEventStore.append(event);
    }

    getEvents(afterSequence: number | null, limit: number): Promise<RuntimeEventRecordV1[]> {
        return runtimeEventStore.list(afterSequence, limit);
    }
}

export const runtimeEventLogService: RuntimeEventLogService = new RuntimeEventLogServiceImpl();

