import {
    errProviderAdapter,
    okProviderAdapter,
    toProviderAdapterException,
    type ProviderAdapterResult,
} from '@/app/backend/providers/adapters/errors';
import {
    parseChatCompletionsPayload,
    parseResponsesPayload,
    type RuntimeParsedCompletion,
} from '@/app/backend/providers/adapters/runtimePayload';
import type { ProviderRuntimeHandlers, ProviderRuntimeInput } from '@/app/backend/providers/types';
import { appLog } from '@/app/main/logging';

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

function resolveAuthToken(input: ProviderRuntimeInput): ProviderAdapterResult<string> {
    const token = input.accessToken ?? input.apiKey;
    if (!token) {
        return errProviderAdapter('auth_missing', 'OpenAI runtime execution requires API key or OAuth access token.');
    }

    return okProviderAdapter(token);
}

async function fetchJson(input: {
    url: string;
    token: string;
    body: Record<string, unknown>;
    signal: AbortSignal;
}): Promise<ProviderAdapterResult<HttpJsonResult>> {
    try {
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

        return okProviderAdapter({
            ok: response.ok,
            status: response.status,
            statusText: response.statusText,
            payload,
        });
    } catch (error) {
        return errProviderAdapter(
            'provider_request_unavailable',
            error instanceof Error ? error.message : 'OpenAI runtime request failed before receiving a response.'
        );
    }
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
    parsed: RuntimeParsedCompletion,
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

    const contextMessages =
        input.contextMessages && input.contextMessages.length > 0
            ? input.contextMessages
            : [{ role: 'user' as const, text: input.promptText }];

    const body: Record<string, unknown> = {
        model: toUpstreamModelId(input.modelId),
        input: contextMessages.map((message) => ({
            role: message.role,
            content: [
                {
                    type: 'input_text',
                    text: message.text,
                },
            ],
        })),
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
    const contextMessages =
        input.contextMessages && input.contextMessages.length > 0
            ? input.contextMessages
            : [{ role: 'user' as const, text: input.promptText }];

    return {
        model: toUpstreamModelId(input.modelId),
        messages: contextMessages.map((message) => ({
            role: message.role,
            content: message.text,
        })),
        stream: false,
        stream_options: {
            include_usage: true,
        },
    };
}

function throwWithLog(input: ProviderRuntimeInput, context: string, code: string, error: string): never {
    appLog.warn({
        tag: 'provider.openai',
        message: `OpenAI runtime ${context} failed.`,
        runId: input.runId,
        profileId: input.profileId,
        sessionId: input.sessionId,
        modelId: input.modelId,
        code,
        error,
    });

    throw toProviderAdapterException({
        code: 'provider_request_failed',
        message: error,
    });
}

export async function streamOpenAIRuntime(
    input: ProviderRuntimeInput,
    handlers: ProviderRuntimeHandlers
): Promise<void> {
    const tokenResult = resolveAuthToken(input);
    if (tokenResult.isErr()) {
        throwWithLog(input, 'auth resolution', tokenResult.error.code, tokenResult.error.message);
    }
    const token = tokenResult.value;
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
        if (chatResult.isErr()) {
            throwWithLog(input, 'chat request', chatResult.error.code, chatResult.error.message);
        }
        if (!chatResult.value.ok) {
            throwWithLog(
                input,
                'chat request',
                'provider_request_failed',
                `OpenAI chat completion failed: ${String(chatResult.value.status)} ${chatResult.value.statusText}`
            );
        }

        const parsed = parseChatCompletionsPayload(chatResult.value.payload);
        if (parsed.isErr()) {
            throwWithLog(input, 'chat payload parse', parsed.error.code, parsed.error.message);
        }
        await emitParsedCompletion(parsed.value, handlers, startedAt);
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
    if (responsesResult.isErr()) {
        throwWithLog(input, 'responses request', responsesResult.error.code, responsesResult.error.message);
    }

    if (responsesResult.value.ok) {
        const parsed = parseResponsesPayload(responsesResult.value.payload);
        if (parsed.isErr()) {
            throwWithLog(input, 'responses payload parse', parsed.error.code, parsed.error.message);
        }
        await emitParsedCompletion(parsed.value, handlers, startedAt);
        return;
    }

    if (!shouldFallbackToChat(responsesResult.value)) {
        throwWithLog(
            input,
            'responses request',
            'provider_request_failed',
            `OpenAI responses completion failed: ${String(responsesResult.value.status)} ${responsesResult.value.statusText}`
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
    if (chatResult.isErr()) {
        throwWithLog(input, 'chat fallback request', chatResult.error.code, chatResult.error.message);
    }
    if (!chatResult.value.ok) {
        throwWithLog(
            input,
            'chat fallback request',
            'provider_request_failed',
            `OpenAI chat fallback failed: ${String(chatResult.value.status)} ${chatResult.value.statusText}`
        );
    }

    const parsed = parseChatCompletionsPayload(chatResult.value.payload);
    if (parsed.isErr()) {
        throwWithLog(input, 'chat fallback payload parse', parsed.error.code, parsed.error.message);
    }
    await emitParsedCompletion(parsed.value, handlers, startedAt);
}
