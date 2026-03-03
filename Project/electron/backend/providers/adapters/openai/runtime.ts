import { parseChatCompletionsPayload, parseResponsesPayload } from '@/app/backend/providers/adapters/runtimePayload';
import type { ProviderRuntimeHandlers, ProviderRuntimeInput } from '@/app/backend/providers/types';

const OPENAI_CHAT_COMPLETIONS_ENDPOINT =
    process.env['OPENAI_CHAT_COMPLETIONS_ENDPOINT']?.trim() || 'https://api.openai.com/v1/chat/completions';
const OPENAI_RESPONSES_ENDPOINT =
    process.env['OPENAI_RESPONSES_ENDPOINT']?.trim() || 'https://api.openai.com/v1/responses';

interface HttpJsonResult {
    ok: boolean;
    status: number;
    statusText: string;
    payload: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readOptionalString(value: unknown): string | undefined {
    if (typeof value !== 'string') {
        return undefined;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
}

function toUpstreamModelId(modelId: string): string {
    return modelId.startsWith('openai/') ? modelId.slice('openai/'.length) : modelId;
}

function resolveAuthToken(input: ProviderRuntimeInput): string {
    const token = input.accessToken ?? input.apiKey;
    if (!token) {
        throw new Error('OpenAI runtime execution requires API key or OAuth access token.');
    }

    return token;
}

async function fetchJson(input: {
    url: string;
    token: string;
    body: Record<string, unknown>;
    signal: AbortSignal;
}): Promise<HttpJsonResult> {
    const response = await fetch(input.url, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${input.token}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(input.body),
        signal: input.signal,
    });

    let payload: unknown;
    try {
        payload = (await response.json()) as unknown;
    } catch {
        payload = {};
    }

    return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        payload,
    };
}

function mapReasoningEffort(
    input: ProviderRuntimeInput['runtimeOptions']['reasoning']['effort']
): 'minimal' | 'low' | 'medium' | 'high' | undefined {
    if (input === 'none') {
        return undefined;
    }

    if (input === 'xhigh') {
        return 'high';
    }

    return input;
}

function shouldFallbackToChat(result: HttpJsonResult): boolean {
    if (result.status === 404 || result.status === 405 || result.status === 415) {
        return true;
    }

    if (result.status !== 400 && result.status !== 422) {
        return false;
    }

    if (!isRecord(result.payload)) {
        return false;
    }

    const errorField = result.payload['error'];
    if (!isRecord(errorField)) {
        return false;
    }

    const code = readOptionalString(errorField['code'])?.toLowerCase();
    const message = readOptionalString(errorField['message'])?.toLowerCase();
    const param = readOptionalString(errorField['param'])?.toLowerCase();

    if (code?.includes('unsupported')) {
        return true;
    }
    if (message?.includes('unsupported')) {
        return true;
    }
    if (message?.includes('responses')) {
        return true;
    }
    if (param?.includes('reasoning')) {
        return true;
    }

    return false;
}

async function emitParsedCompletion(
    parsed: ReturnType<typeof parseResponsesPayload>,
    handlers: ProviderRuntimeHandlers,
    startedAt: number
): Promise<void> {
    for (const part of parsed.parts) {
        await handlers.onPart(part);
    }

    if (handlers.onUsage) {
        await handlers.onUsage({
            ...parsed.usage,
            latencyMs: Date.now() - startedAt,
        });
    }
}

function buildResponsesBody(input: ProviderRuntimeInput): Record<string, unknown> {
    const effort = mapReasoningEffort(input.runtimeOptions.reasoning.effort);
    const include = input.runtimeOptions.reasoning.includeEncrypted ? ['reasoning.encrypted_content'] : [];

    const body: Record<string, unknown> = {
        model: toUpstreamModelId(input.modelId),
        input: [
            {
                role: 'user',
                content: [
                    {
                        type: 'input_text',
                        text: input.promptText,
                    },
                ],
            },
        ],
        reasoning: {
            summary: input.runtimeOptions.reasoning.summary,
            ...(effort ? { effort } : {}),
        },
    };

    if (include.length > 0) {
        body['include'] = include;
    }

    return body;
}

function buildChatCompletionsBody(input: ProviderRuntimeInput): Record<string, unknown> {
    return {
        model: toUpstreamModelId(input.modelId),
        messages: [
            {
                role: 'user',
                content: input.promptText,
            },
        ],
        stream: false,
        stream_options: {
            include_usage: true,
        },
    };
}

export async function streamOpenAIRuntime(
    input: ProviderRuntimeInput,
    handlers: ProviderRuntimeHandlers
): Promise<void> {
    const token = resolveAuthToken(input);
    const startedAt = Date.now();

    if (handlers.onCacheResolved) {
        await handlers.onCacheResolved(input.cache);
    }

    const forceChatTransport = input.runtimeOptions.transport.openai === 'chat';
    if (forceChatTransport) {
        if (handlers.onTransportSelected) {
            await handlers.onTransportSelected({
                selected: 'chat_completions',
                requested: input.runtimeOptions.transport.openai,
                degraded: false,
            });
        }

        const chatResult = await fetchJson({
            url: OPENAI_CHAT_COMPLETIONS_ENDPOINT,
            token,
            body: buildChatCompletionsBody(input),
            signal: input.signal,
        });
        if (!chatResult.ok) {
            throw new Error(`OpenAI chat completion failed: ${String(chatResult.status)} ${chatResult.statusText}`);
        }

        const parsed = parseChatCompletionsPayload(chatResult.payload);
        await emitParsedCompletion(parsed, handlers, startedAt);
        return;
    }

    if (handlers.onTransportSelected) {
        await handlers.onTransportSelected({
            selected: 'responses',
            requested: input.runtimeOptions.transport.openai,
            degraded: false,
        });
    }

    const responsesResult = await fetchJson({
        url: OPENAI_RESPONSES_ENDPOINT,
        token,
        body: buildResponsesBody(input),
        signal: input.signal,
    });

    if (responsesResult.ok) {
        const parsed = parseResponsesPayload(responsesResult.payload);
        await emitParsedCompletion(parsed, handlers, startedAt);
        return;
    }

    if (!shouldFallbackToChat(responsesResult)) {
        throw new Error(
            `OpenAI responses completion failed: ${String(responsesResult.status)} ${responsesResult.statusText}`
        );
    }

    if (handlers.onTransportSelected) {
        await handlers.onTransportSelected({
            selected: 'chat_completions',
            requested: input.runtimeOptions.transport.openai,
            degraded: true,
            degradedReason: 'responses_unsupported',
        });
    }

    const chatResult = await fetchJson({
        url: OPENAI_CHAT_COMPLETIONS_ENDPOINT,
        token,
        body: buildChatCompletionsBody(input),
        signal: input.signal,
    });
    if (!chatResult.ok) {
        throw new Error(`OpenAI chat fallback failed: ${String(chatResult.status)} ${chatResult.statusText}`);
    }

    const parsed = parseChatCompletionsPayload(chatResult.payload);
    await emitParsedCompletion(parsed, handlers, startedAt);
}
