import { createTextMessage } from '@/app/backend/runtime/services/runExecution/contextParts';
import type { RunContextMessage } from '@/app/backend/runtime/services/runExecution/types';

import type { MemoryRecord } from '@/app/backend/persistence/types';
import type { RetrievedMemoryRecord } from '@/app/backend/runtime/contracts';

const MAX_RETRIEVED_MEMORY_TEXT_LENGTH = 6_000;
const MEMORY_ENTRY_TEXT_LIMIT = 1_000;

function normalizeWhitespace(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

function formatMemoryBody(memory: MemoryRecord, remainingBudget: number): string {
    const normalizedSummary = normalizeWhitespace(memory.summaryText ?? '');
    const normalizedBody = normalizeWhitespace(memory.bodyMarkdown);
    const candidate = normalizedSummary.length > 0 ? `${normalizedSummary}\n\n${normalizedBody}` : normalizedBody;
    const boundedLength = Math.max(0, Math.min(MEMORY_ENTRY_TEXT_LIMIT, remainingBudget));
    if (candidate.length <= boundedLength) {
        return candidate;
    }
    if (boundedLength <= 3) {
        return candidate.slice(0, boundedLength);
    }

    return `${candidate.slice(0, boundedLength - 3)}...`;
}

function describeMemoryProvenance(memory: MemoryRecord): string {
    const segments = [
        `scope=${memory.scopeKind}`,
        ...(memory.runId ? [`run=${memory.runId}`] : []),
        ...(memory.threadId ? [`thread=${memory.threadId}`] : []),
        ...(memory.workspaceFingerprint ? [`workspace=${memory.workspaceFingerprint}`] : []),
    ];

    return segments.join(', ');
}

export function formatRetrievedMemoryMessage(
    records: RetrievedMemoryRecord[],
    memoriesById: Map<string, MemoryRecord>
): {
    message: RunContextMessage;
    injectedTextLength: number;
} | null {
    const lines: string[] = ['Retrieved memory', ''];

    for (const record of records) {
        const memory = memoriesById.get(record.memoryId);
        if (!memory) {
            continue;
        }

        const currentText = lines.join('\n');
        const remainingBudget = MAX_RETRIEVED_MEMORY_TEXT_LENGTH - currentText.length;
        if (remainingBudget <= 0) {
            break;
        }

        const excerpt = formatMemoryBody(memory, remainingBudget);
        lines.push(
            `${String(record.order)}. ${memory.title}`,
            `Type: ${memory.memoryType}`,
            `Scope: ${memory.scopeKind}`,
            `Match reason: ${record.matchReason}`,
            `Provenance: ${describeMemoryProvenance(memory)}`,
            ...(record.annotations && record.annotations.length > 0 ? [`Notes: ${record.annotations.join(' ')}`] : []),
            'Details:',
            excerpt,
            ''
        );
    }

    const text = lines.join('\n').trim();
    if (text === 'Retrieved memory') {
        return null;
    }

    return {
        message: createTextMessage('system', text),
        injectedTextLength: text.length,
    };
}

