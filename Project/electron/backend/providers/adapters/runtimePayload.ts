export interface RuntimeParsedCompletion {
    text: string;
    usage: {
        inputTokens?: number;
        outputTokens?: number;
        cachedTokens?: number;
        reasoningTokens?: number;
        totalTokens?: number;
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readOptionalString(value: unknown): string | undefined {
    if (typeof value !== 'string') {
        return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

function readOptionalNumber(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readTextContent(value: unknown): string {
    if (typeof value === 'string') {
        return value;
    }

    if (!Array.isArray(value)) {
        return '';
    }

    const chunks: string[] = [];
    for (const entry of value) {
        if (!isRecord(entry)) {
            continue;
        }

        const direct = readOptionalString(entry['text']);
        if (direct) {
            chunks.push(direct);
            continue;
        }

        const nestedText = entry['text'];
        const nested = isRecord(nestedText) ? readOptionalString(nestedText['value']) : undefined;
        if (nested) {
            chunks.push(nested);
        }
    }

    return chunks.join('');
}

function normalizeUsage(value: unknown): RuntimeParsedCompletion['usage'] {
    if (!isRecord(value)) {
        return {};
    }

    const usage: RuntimeParsedCompletion['usage'] = {};
    const promptTokens = readOptionalNumber(value['prompt_tokens']);
    const completionTokens = readOptionalNumber(value['completion_tokens']);
    const inputTokens = readOptionalNumber(value['input_tokens']);
    const outputTokens = readOptionalNumber(value['output_tokens']);
    const cachedTokens = readOptionalNumber(value['cached_tokens']);
    const reasoningTokens = readOptionalNumber(value['reasoning_tokens']);
    const totalTokens = readOptionalNumber(value['total_tokens']);

    if (promptTokens !== undefined) usage.inputTokens = promptTokens;
    if (completionTokens !== undefined) usage.outputTokens = completionTokens;
    if (inputTokens !== undefined) usage.inputTokens = inputTokens;
    if (outputTokens !== undefined) usage.outputTokens = outputTokens;
    if (cachedTokens !== undefined) usage.cachedTokens = cachedTokens;
    if (reasoningTokens !== undefined) usage.reasoningTokens = reasoningTokens;
    if (totalTokens !== undefined) usage.totalTokens = totalTokens;

    return usage;
}

export function parseChatCompletionsPayload(payload: unknown): RuntimeParsedCompletion {
    if (!isRecord(payload)) {
        throw new Error('Invalid chat completion payload.');
    }

    const choices = Array.isArray(payload['choices']) ? payload['choices'] : [];
    const firstChoice = choices.find((item) => isRecord(item));
    const message = firstChoice && isRecord(firstChoice['message']) ? firstChoice['message'] : null;
    const text = message ? readTextContent(message['content']) : '';

    return {
        text,
        usage: normalizeUsage(payload['usage']),
    };
}

export function parseResponsesPayload(payload: unknown): RuntimeParsedCompletion {
    if (!isRecord(payload)) {
        throw new Error('Invalid responses payload.');
    }

    const output = Array.isArray(payload['output']) ? payload['output'] : [];
    const firstOutput = output.find((item) => isRecord(item));
    const content = firstOutput && Array.isArray(firstOutput['content']) ? firstOutput['content'] : [];
    const text = content
        .filter((item): item is Record<string, unknown> => isRecord(item))
        .map((item) => readOptionalString(item['text']) ?? '')
        .join('');

    return {
        text,
        usage: normalizeUsage(payload['usage']),
    };
}
