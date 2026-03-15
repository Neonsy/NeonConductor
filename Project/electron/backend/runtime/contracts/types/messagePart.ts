export const assistantStatusPartCodes = ['received', 'stalled', 'failed_before_output'] as const;
export type AssistantStatusPartCode = (typeof assistantStatusPartCodes)[number];

export interface AssistantStatusPartPayload extends Record<string, unknown> {
    code: AssistantStatusPartCode;
    label: string;
    elapsedMs?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readAssistantStatusPartCode(value: unknown): AssistantStatusPartCode | undefined {
    return typeof value === 'string' && assistantStatusPartCodes.includes(value as AssistantStatusPartCode)
        ? (value as AssistantStatusPartCode)
        : undefined;
}

export function createAssistantStatusPartPayload(input: AssistantStatusPartPayload): AssistantStatusPartPayload {
    return input.elapsedMs === undefined
        ? {
              code: input.code,
              label: input.label,
          }
        : {
              code: input.code,
              label: input.label,
              elapsedMs: input.elapsedMs,
          };
}

export function parseAssistantStatusPartPayload(value: unknown): AssistantStatusPartPayload | null {
    if (!isRecord(value)) {
        return null;
    }

    const code = readAssistantStatusPartCode(value['code']);
    const label = typeof value['label'] === 'string' && value['label'].trim().length > 0 ? value['label'] : undefined;
    const elapsedMs =
        typeof value['elapsedMs'] === 'number' && Number.isFinite(value['elapsedMs']) ? value['elapsedMs'] : undefined;

    if (!code || !label) {
        return null;
    }

    return createAssistantStatusPartPayload({
        code,
        label,
        ...(elapsedMs !== undefined ? { elapsedMs } : {}),
    });
}
