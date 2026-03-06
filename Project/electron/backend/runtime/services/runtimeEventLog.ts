import { runtimeEventStore } from '@/app/backend/persistence/stores';
import type { RuntimeEventRecordV1 } from '@/app/backend/persistence/types';
import { runtimeEventBus } from '@/app/backend/runtime/services/runtimeEventBus';
import type { RuntimeEventEnvelopeInput } from '@/app/backend/runtime/services/runtimeEventEnvelope';

export interface RuntimeEventLogService {
    append(event: RuntimeEventEnvelopeInput): Promise<RuntimeEventRecordV1>;
    getEvents(afterSequence: number | null, limit: number): Promise<RuntimeEventRecordV1[]>;
}

class RuntimeEventLogServiceImpl implements RuntimeEventLogService {
    async append(event: RuntimeEventEnvelopeInput): Promise<RuntimeEventRecordV1> {
        const appended = await runtimeEventStore.append({
            entityType: event.entityType,
            domain: event.domain,
            operation: event.operation,
            entityId: event.entityId,
            eventType: event.eventType,
            payload: {
                ...event.payload,
                ...(event.requestId ? { requestId: event.requestId } : {}),
                ...(event.correlationId ? { correlationId: event.correlationId } : {}),
                ...(event.origin ? { origin: event.origin } : {}),
            },
        });
        runtimeEventBus.publish(appended);
        return appended;
    }

    getEvents(afterSequence: number | null, limit: number): Promise<RuntimeEventRecordV1[]> {
        return runtimeEventStore.list(afterSequence, limit);
    }
}

export const runtimeEventLogService: RuntimeEventLogService = new RuntimeEventLogServiceImpl();
