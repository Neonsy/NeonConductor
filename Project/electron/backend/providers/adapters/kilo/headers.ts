import {
    DEFAULT_CLIENT_VERSION,
    DEFAULT_EDITOR_NAME,
    HEADER_EDITOR_NAME,
    HEADER_MODE,
    HEADER_ORGANIZATION_ID,
    HEADER_TASK_ID,
} from '@/app/backend/providers/kiloGatewayClient/constants';
import type { ProviderRuntimeInput } from '@/app/backend/providers/types';

export function resolveKiloRuntimeAuthToken(input: ProviderRuntimeInput): string {
    const token = input.accessToken ?? input.apiKey;
    if (!token) {
        throw new Error('Kilo runtime execution requires access token or API key.');
    }

    return token;
}

function mapReasoningEffort(
    effort: ProviderRuntimeInput['runtimeOptions']['reasoning']['effort']
): 'minimal' | 'low' | 'medium' | 'high' | undefined {
    if (effort === 'none') {
        return undefined;
    }
    if (effort === 'xhigh') {
        return 'high';
    }

    return effort;
}

export function buildKiloRuntimeHeaders(input: {
    token: string;
    organizationId?: string;
    modelId: string;
    cacheKey?: string;
}): Record<string, string> {
    const headers: Record<string, string> = {
        Authorization: `Bearer ${input.token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'neonconductor-gateway-client',
        [HEADER_EDITOR_NAME]: DEFAULT_EDITOR_NAME,
        'X-NeonConductor-Client-Version': DEFAULT_CLIENT_VERSION,
    };

    if (input.organizationId) {
        headers[HEADER_ORGANIZATION_ID] = input.organizationId;
    }

    if (input.modelId === 'kilo/auto') {
        headers[HEADER_MODE] = 'code';
    }

    if (input.cacheKey) {
        headers[HEADER_TASK_ID] = input.cacheKey;
    }

    return headers;
}

export function buildKiloRuntimeBody(input: ProviderRuntimeInput): Record<string, unknown> {
    const effort = mapReasoningEffort(input.runtimeOptions.reasoning.effort);
    const body: Record<string, unknown> = {
        model: input.modelId,
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

    if (effort || input.runtimeOptions.reasoning.summary !== 'none') {
        body['reasoning'] = {
            summary: input.runtimeOptions.reasoning.summary,
            ...(effort ? { effort } : {}),
        };
    }

    return body;
}
