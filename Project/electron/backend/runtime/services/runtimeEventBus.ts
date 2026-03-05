import type { RuntimeEventRecordV1 } from '@/app/backend/persistence/types';
import { appLog } from '@/app/main/logging';

type RuntimeEventListener = (event: RuntimeEventRecordV1) => void;

export interface RuntimeEventBus {
    publish(event: RuntimeEventRecordV1): void;
    subscribe(listener: RuntimeEventListener): () => void;
}

class RuntimeEventBusImpl implements RuntimeEventBus {
    private readonly listeners = new Set<RuntimeEventListener>();

    publish(event: RuntimeEventRecordV1): void {
        for (const listener of this.listeners) {
            try {
                listener(event);
            } catch (error) {
                appLog.error({
                    tag: 'runtime-event-bus',
                    message: 'Listener failed while handling runtime event.',
                    ...(error instanceof Error ? { error: error.message } : { error: String(error) }),
                    eventType: event.eventType,
                    entityType: event.entityType,
                    entityId: event.entityId,
                });
            }
        }
    }

    subscribe(listener: RuntimeEventListener): () => void {
        this.listeners.add(listener);

        return () => {
            this.listeners.delete(listener);
        };
    }
}

export const runtimeEventBus: RuntimeEventBus = new RuntimeEventBusImpl();
