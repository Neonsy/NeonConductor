import {
    OPENAI_OAUTH_AUTHORIZE_URL,
    OPENAI_OAUTH_CLIENT_ID,
    OPENAI_OAUTH_DEVICE_CODE_URL,
    OPENAI_OAUTH_REDIRECT_URI,
    OPENAI_OAUTH_TOKEN_URL,
} from '@/app/backend/providers/auth/constants';
import { errAuthExecution, okAuthExecution, type AuthExecutionResult } from '@/app/backend/providers/auth/errors';
import {
    createOpaque,
    createPkceChallenge,
    isRecord,
    plusSeconds,
    readOpenAIAccountId,
    readString,
} from '@/app/backend/providers/auth/helpers';
import type { OpenAITokenPayload } from '@/app/backend/providers/auth/types';

function parseOpenAITokenPayload(payload: unknown): AuthExecutionResult<OpenAITokenPayload> {
    if (!isRecord(payload)) {
        return errAuthExecution('invalid_payload', 'Invalid OpenAI token payload.');
    }

    const accessToken = readString(payload['access_token']);
    if (!accessToken) {
        const errorCode = readString(payload['error']) ?? 'unknown';
        const errorDescription = readString(payload['error_description']) ?? 'OpenAI token exchange failed.';
        return errAuthExecution('provider_request_failed', `${errorCode}: ${errorDescription}`);
    }

    const expiresIn =
        typeof payload['expires_in'] === 'number' && Number.isFinite(payload['expires_in'])
            ? payload['expires_in']
            : undefined;
    const refreshToken = readString(payload['refresh_token']);
    const claimedAccountId = readString(payload['account_id']);
    const inferredAccountId = readOpenAIAccountId(accessToken);

    return okAuthExecution({
        accessToken,
        ...(refreshToken ? { refreshToken } : {}),
        ...(expiresIn !== undefined ? { expiresAt: plusSeconds(expiresIn) } : {}),
        ...(claimedAccountId
            ? { accountId: claimedAccountId }
            : inferredAccountId
              ? { accountId: inferredAccountId }
              : {}),
    });
}

async function postForm(endpoint: string, body: URLSearchParams): Promise<AuthExecutionResult<unknown>> {
    let response: Response;

    try {
        response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Accept: 'application/json',
            },
            body,
            signal: AbortSignal.timeout(15_000),
        });
    } catch (error) {
        return errAuthExecution(
            'provider_request_unavailable',
            error instanceof Error ? error.message : 'OpenAI request failed before receiving a response.'
        );
    }

    let payload: unknown;
    try {
        payload = (await response.json()) as unknown;
    } catch {
        return errAuthExecution('invalid_payload', 'OpenAI request returned invalid JSON payload.');
    }

    if (!response.ok) {
        if (isRecord(payload)) {
            const errorCode = readString(payload['error']) ?? 'unknown';
            const errorDescription =
                readString(payload['error_description']) ?? `OpenAI request failed (${String(response.status)}).`;
            return errAuthExecution('provider_request_failed', `${errorCode}: ${errorDescription}`);
        }

        return errAuthExecution('provider_request_failed', `OpenAI request failed (${String(response.status)}).`);
    }

    return okAuthExecution(payload);
}

export interface OpenAIPkceStartResult {
    state: string;
    nonce: string;
    codeVerifier: string;
    authorizeUrl: string;
}

export interface OpenAIDeviceStartResult {
    deviceCode: string;
    userCode: string;
    verificationUri: string;
    intervalSeconds: number;
    expiresInSeconds: number;
}

export async function startOpenAIDeviceAuth(): Promise<AuthExecutionResult<OpenAIDeviceStartResult>> {
    const payloadResult = await postForm(
        OPENAI_OAUTH_DEVICE_CODE_URL,
        new URLSearchParams({
            client_id: OPENAI_OAUTH_CLIENT_ID,
            scope: 'openid profile offline_access',
        })
    );
    if (payloadResult.isErr()) {
        return errAuthExecution(payloadResult.error.code, payloadResult.error.message);
    }
    const payload = payloadResult.value;

    if (!isRecord(payload)) {
        return errAuthExecution('invalid_payload', 'Invalid OpenAI device auth payload.');
    }

    const deviceCode = readString(payload['device_code']);
    const userCode = readString(payload['user_code']);
    const verificationUri =
        readString(payload['verification_uri']) ??
        readString(payload['verification_uri_complete']) ??
        readString(payload['verificationUrl']);
    const intervalSeconds = typeof payload['interval'] === 'number' ? payload['interval'] : 5;
    const expiresInSeconds = typeof payload['expires_in'] === 'number' ? payload['expires_in'] : 900;

    if (!deviceCode || !userCode || !verificationUri) {
        return errAuthExecution('invalid_payload', 'OpenAI device auth payload is missing required fields.');
    }

    return okAuthExecution({
        deviceCode,
        userCode,
        verificationUri,
        intervalSeconds,
        expiresInSeconds,
    });
}

export function startOpenAIPkceAuth(): OpenAIPkceStartResult {
    const state = createOpaque(24);
    const nonce = createOpaque(24);
    const codeVerifier = createOpaque(48);
    const codeChallenge = createPkceChallenge(codeVerifier);

    const authorizeUrl = new URL(OPENAI_OAUTH_AUTHORIZE_URL);
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('client_id', OPENAI_OAUTH_CLIENT_ID);
    authorizeUrl.searchParams.set('redirect_uri', OPENAI_OAUTH_REDIRECT_URI);
    authorizeUrl.searchParams.set('scope', 'openid profile offline_access');
    authorizeUrl.searchParams.set('state', state);
    authorizeUrl.searchParams.set('nonce', nonce);
    authorizeUrl.searchParams.set('code_challenge', codeChallenge);
    authorizeUrl.searchParams.set('code_challenge_method', 'S256');

    return {
        state,
        nonce,
        codeVerifier,
        authorizeUrl: authorizeUrl.toString(),
    };
}

export async function exchangeOpenAIAuthorizationCode(
    code: string,
    codeVerifier: string
): Promise<AuthExecutionResult<OpenAITokenPayload>> {
    const payloadResult = await postForm(
        OPENAI_OAUTH_TOKEN_URL,
        new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: OPENAI_OAUTH_CLIENT_ID,
            redirect_uri: OPENAI_OAUTH_REDIRECT_URI,
            code_verifier: codeVerifier,
            code,
        })
    );
    if (payloadResult.isErr()) {
        return errAuthExecution(payloadResult.error.code, payloadResult.error.message);
    }

    return parseOpenAITokenPayload(payloadResult.value);
}

export async function exchangeOpenAIDeviceCode(
    deviceCode: string
): Promise<AuthExecutionResult<OpenAITokenPayload | null>> {
    let response: Response;
    try {
        response = await fetch(OPENAI_OAUTH_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Accept: 'application/json',
            },
            body: new URLSearchParams({
                grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
                client_id: OPENAI_OAUTH_CLIENT_ID,
                device_code: deviceCode,
            }),
            signal: AbortSignal.timeout(15_000),
        });
    } catch (error) {
        return errAuthExecution(
            'provider_request_unavailable',
            error instanceof Error ? error.message : 'OpenAI device exchange request failed.'
        );
    }

    let payload: unknown;
    try {
        payload = (await response.json()) as unknown;
    } catch {
        return errAuthExecution('invalid_payload', 'OpenAI device exchange returned invalid JSON payload.');
    }

    if (!response.ok) {
        if (isRecord(payload) && readString(payload['error']) === 'authorization_pending') {
            return okAuthExecution(null);
        }

        if (isRecord(payload) && readString(payload['error']) === 'expired_token') {
            return errAuthExecution('provider_request_failed', 'expired_token: OpenAI device code expired.');
        }

        const errorDescription = isRecord(payload)
            ? (readString(payload['error_description']) ??
              `OpenAI device exchange failed (${String(response.status)}).`)
            : `OpenAI device exchange failed (${String(response.status)}).`;
        return errAuthExecution('provider_request_failed', errorDescription);
    }

    return parseOpenAITokenPayload(payload);
}

export async function refreshOpenAIToken(refreshToken: string): Promise<AuthExecutionResult<OpenAITokenPayload>> {
    const payloadResult = await postForm(
        OPENAI_OAUTH_TOKEN_URL,
        new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: OPENAI_OAUTH_CLIENT_ID,
            refresh_token: refreshToken,
        })
    );
    if (payloadResult.isErr()) {
        return errAuthExecution(payloadResult.error.code, payloadResult.error.message);
    }

    return parseOpenAITokenPayload(payloadResult.value);
}
