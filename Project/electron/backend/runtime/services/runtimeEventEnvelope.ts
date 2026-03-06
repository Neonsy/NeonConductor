import type { RuntimeEntityType, RuntimeEventDomain, RuntimeEventOperation } from '@/app/backend/persistence/types';

function classifyRuntimeEventDomain(entityType: RuntimeEntityType, eventType: string): RuntimeEventDomain {
    if (eventType.startsWith('conversation.thread.')) {
        return 'thread';
    }
    if (eventType.startsWith('session.')) {
        return 'session';
    }
    if (eventType === 'run.part.appended' || eventType === 'run.reasoning.appended') {
        return 'messagePart';
    }
    if (eventType.startsWith('run.')) {
        return 'run';
    }
    if (eventType.startsWith('provider.')) {
        return 'provider';
    }
    if (eventType.startsWith('plan.')) {
        return 'plan';
    }
    if (eventType.startsWith('orchestrator.')) {
        return 'orchestrator';
    }
    if (eventType.startsWith('profile.')) {
        return 'profile';
    }
    if (eventType.startsWith('permission.')) {
        return 'permission';
    }
    if (eventType.startsWith('tool.')) {
        return 'tool';
    }
    if (eventType.startsWith('mcp.')) {
        return 'mcp';
    }
    if (eventType.startsWith('runtime.') || eventType.startsWith('mode.')) {
        return 'runtime';
    }
    if (entityType === 'thread' || entityType === 'conversation') {
        return 'conversation';
    }
    if (entityType === 'tag') {
        return 'tag';
    }

    return entityType === 'message' || entityType === 'messagePart' ? entityType : 'runtime';
}

function classifyRuntimeEventOperation(eventType: string): RuntimeEventOperation {
    if (eventType === 'run.part.appended' || eventType === 'run.reasoning.appended') {
        return 'append';
    }
    if (eventType === 'runtime.reset.applied') {
        return 'reset';
    }
    if (eventType === 'provider.catalog.sync') {
        return 'sync';
    }
    if (eventType.endsWith('.deleted')) {
        return 'remove';
    }

    const lastSegment = eventType.split('.').at(-1);
    if (!lastSegment) {
        throw new Error(`Runtime event type "${eventType}" is invalid.`);
    }

    if (lastSegment === 'appended') {
        return 'append';
    }

    if (lastSegment.endsWith('-set')) {
        return 'upsert';
    }

    if (
        lastSegment === 'started' ||
        lastSegment === 'completed' ||
        lastSegment === 'aborted' ||
        lastSegment === 'failed' ||
        lastSegment === 'requested' ||
        lastSegment === 'answered' ||
        lastSegment === 'approved' ||
        lastSegment === 'applied' ||
        lastSegment === 'skipped' ||
        lastSegment === 'blocked' ||
        lastSegment === 'polled' ||
        lastSegment === 'refreshed' ||
        lastSegment === 'cancelled' ||
        lastSegment === 'cleared' ||
        lastSegment === 'recorded' ||
        lastSegment === 'selected' ||
        lastSegment === 'context' ||
        lastSegment === 'unsupported' ||
        lastSegment === 'granted' ||
        lastSegment === 'denied'
    ) {
        return 'status';
    }

    if (
        lastSegment === 'created' ||
        lastSegment === 'renamed' ||
        lastSegment === 'duplicated' ||
        lastSegment === 'edited' ||
        lastSegment === 'reverted' ||
        lastSegment === 'activated' ||
        lastSegment === 'set' ||
        lastSegment === 'updated'
    ) {
        return 'upsert';
    }

    throw new Error(`Runtime event type "${eventType}" is not classified.`);
}

export function classifyRuntimeEventEnvelope(input: {
    entityType: RuntimeEntityType;
    eventType: string;
}): {
    domain: RuntimeEventDomain;
    operation: RuntimeEventOperation;
} {
    return {
        domain: classifyRuntimeEventDomain(input.entityType, input.eventType),
        operation: classifyRuntimeEventOperation(input.eventType),
    };
}
