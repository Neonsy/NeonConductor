import { describe, expect, it } from 'vitest';

import type { MemoryRecord } from '@/app/backend/persistence/types';
import {
    parseMemoryProposal,
    readParsedState,
    renderProjectedMemoryFile,
} from '@/app/backend/runtime/services/memory/memoryProjectionFileCodec';

function createMemory(overrides?: Partial<MemoryRecord>): MemoryRecord {
    return {
        id: 'mem_test' as MemoryRecord['id'],
        profileId: 'profile_test',
        memoryType: 'procedural',
        scopeKind: 'thread',
        state: 'active',
        createdByKind: 'user',
        title: 'Original title',
        bodyMarkdown: 'Original body.',
        metadata: { source: 'manual' },
        workspaceFingerprint: 'ws_test',
        threadId: 'thr_test' as MemoryRecord['threadId'],
        runId: 'run_test' as MemoryRecord['runId'],
        createdAt: '2026-03-27T10:00:00.000Z',
        updatedAt: '2026-03-27T10:00:00.000Z',
        ...overrides,
    };
}

describe('memoryProjectionFileCodec', () => {
    it('renders and parses projected memory files without changing canonical fields', () => {
        const memory = createMemory();
        const rendered = renderProjectedMemoryFile(memory);

        expect(rendered).toContain('id: "mem_test"');
        expect(rendered).toContain('state: "active"');
        expect(rendered).toContain('metadata: {"source":"manual"}');

        const parsed = parseMemoryProposal(memory, rendered);
        expect(parsed.title).toBe('Original title');
        expect(parsed.bodyMarkdown).toBe('Original body.');
        expect(parsed.metadata).toEqual({ source: 'manual' });
        expect(parsed.proposedState).toBe('active');
    });

    it('parses memory state enums and rejects invalid states', () => {
        expect(readParsedState({ state: 'disabled' })).toBe('disabled');
        expect(() => readParsedState({ state: 'not-a-state' })).toThrow('Invalid "state"');
    });
});
