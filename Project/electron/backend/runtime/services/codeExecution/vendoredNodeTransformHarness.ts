export const VENDORED_NODE_TRANSFORM_HARNESS_SOURCE = `
import vm from 'node:vm';
import { stdin, stdout } from 'node:process';

const MAX_LOG_ENTRIES = 80;
const MAX_LOG_TEXT_CHARS = 4_000;
const MAX_RESULT_JSON_CHARS = 64_000;

function byteLength(value) {
    return Buffer.byteLength(value, 'utf8');
}

function truncateText(value, maxChars) {
    if (value.length <= maxChars) {
        return { text: value, truncated: false };
    }

    return {
        text: value.slice(0, Math.max(0, maxChars - 32)) + '\\n... truncated by Neon ...',
        truncated: true,
    };
}

function formatLogValue(value) {
    if (typeof value === 'string') {
        return value;
    }

    if (typeof value === 'undefined') {
        return 'undefined';
    }

    if (typeof value === 'function') {
        return '[Function]';
    }

    try {
        const serialized = JSON.stringify(value);
        return typeof serialized === 'string' ? serialized : String(value);
    } catch (error) {
        return error instanceof Error ? '[Unserializable: ' + error.message + ']' : '[Unserializable]';
    }
}

function createCapturedConsole(logs) {
    return Object.fromEntries(
        ['debug', 'error', 'info', 'log', 'warn'].map((level) => [
            level,
            (...values) => {
                if (logs.length >= MAX_LOG_ENTRIES) {
                    return;
                }

                const joined = values.map(formatLogValue).join(' ');
                const truncated = truncateText(joined, MAX_LOG_TEXT_CHARS);
                logs.push({ level, text: truncated.text, truncated: truncated.truncated });
            },
        ])
    );
}

function serializeResult(value) {
    if (typeof value === 'undefined') {
        return {
            result: null,
            resultSerialization: 'undefined',
            resultBytes: 0,
            resultTruncated: false,
        };
    }

    let json;
    try {
        json = JSON.stringify(value);
    } catch (error) {
        const text = error instanceof Error ? '[Unserializable: ' + error.message + ']' : '[Unserializable]';
        return {
            result: text,
            resultSerialization: 'unserializable_text',
            resultBytes: byteLength(text),
            resultTruncated: false,
        };
    }

    if (typeof json !== 'string') {
        const text = String(value);
        return {
            result: text,
            resultSerialization: 'string',
            resultBytes: byteLength(text),
            resultTruncated: false,
        };
    }

    if (json.length > MAX_RESULT_JSON_CHARS) {
        const truncated = truncateText(json, MAX_RESULT_JSON_CHARS);
        return {
            result: truncated.text,
            resultSerialization: 'json_preview',
            resultBytes: byteLength(json),
            resultTruncated: true,
        };
    }

    return {
        result: JSON.parse(json),
        resultSerialization: 'json',
        resultBytes: byteLength(json),
        resultTruncated: false,
    };
}

function serializeError(error) {
    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
            stack: error.stack,
        };
    }

    if (
        typeof error === 'object' &&
        error !== null &&
        typeof error.name === 'string' &&
        typeof error.message === 'string'
    ) {
        return {
            name: error.name,
            message: error.message,
            stack: typeof error.stack === 'string' ? error.stack : undefined,
        };
    }

    return {
        name: 'ThrownValue',
        message: formatLogValue(error),
    };
}

function readAllStdin() {
    return new Promise((resolve, reject) => {
        let text = '';
        stdin.setEncoding('utf8');
        stdin.on('data', (chunk) => {
            text += chunk;
        });
        stdin.on('error', reject);
        stdin.on('end', () => resolve(text));
    });
}

function writeEnvelope(envelope) {
    stdout.write(JSON.stringify(envelope));
}

const request = JSON.parse(await readAllStdin());
const code = typeof request.code === 'string' ? request.code : '';
const timeoutMs = Number.isFinite(request.timeoutMs) ? request.timeoutMs : 5_000;
const logs = [];
let vmTimedOut = false;

const context = vm.createContext({
    clearInterval,
    clearTimeout,
    console: createCapturedConsole(logs),
    setInterval,
    setTimeout,
});

const startedAt = Date.now();

try {
    const script = new vm.Script('"use strict";\\n(async () => {\\n' + code + '\\n})()', {
        filename: 'neon-execute-code-input.js',
    });
    const value = await script.runInContext(context, {
        timeout: timeoutMs,
        microtaskMode: 'afterEvaluate',
    });
    writeEnvelope({
        ok: true,
        durationMs: Date.now() - startedAt,
        logs,
        logsTruncated: logs.length >= MAX_LOG_ENTRIES,
        ...serializeResult(value),
    });
} catch (error) {
    vmTimedOut = error instanceof Error && error.message.includes('Script execution timed out');
    writeEnvelope({
        ok: false,
        durationMs: Date.now() - startedAt,
        logs,
        logsTruncated: logs.length >= MAX_LOG_ENTRIES,
        error: serializeError(error),
        timedOut: vmTimedOut,
        result: null,
        resultSerialization: 'error',
        resultBytes: 0,
        resultTruncated: false,
    });
}
`;
