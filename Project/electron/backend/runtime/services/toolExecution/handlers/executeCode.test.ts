import { ok } from 'neverthrow';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { executeMock } = vi.hoisted(() => ({
    executeMock: vi.fn(),
}));

vi.mock('@/app/backend/runtime/services/codeExecution/vendoredNodeCodeRunner', () => ({
    vendoredNodeCodeRunner: {
        execute: executeMock,
    },
}));

import { executeCodeToolHandler } from '@/app/backend/runtime/services/toolExecution/handlers/executeCode';

function createMockRunnerSuccess() {
    const result = ok({
        runtime: 'vendored_node',
        runtimeVersion: '24.14.1',
        result: 3,
        resultSerialization: 'json',
        resultBytes: 1,
        resultTruncated: false,
        logs: [],
        logsTruncated: false,
        stderr: '',
        stderrBytes: 0,
        stderrTruncated: false,
        timedOut: false,
        durationMs: 12,
    });
    expect(result.isOk()).toBe(true);
    return result;
}

describe('executeCodeToolHandler', () => {
    beforeEach(() => {
        executeMock.mockReset();
        const runnerSuccess = createMockRunnerSuccess();
        runnerSuccess.match(
            () => undefined,
            () => undefined
        );
        executeMock.mockResolvedValue(runnerSuccess);
    });

    it('requires a non-empty code argument', async () => {
        const result = await executeCodeToolHandler({
            code: '   ',
        });

        expect(result.isErr()).toBe(true);
        if (result.isOk()) {
            throw new Error('Expected blank execute_code input to fail validation.');
        }
        expect(result.error).toEqual({
            code: 'invalid_args',
            message: 'Missing "code" argument.',
        });
        expect(executeMock).not.toHaveBeenCalled();
    });

    it('passes bounded inputs to the vendored Node runner and returns its stable output', async () => {
        const result = await executeCodeToolHandler({
            code: 'return 1 + 2;',
            timeoutMs: 1000,
        });

        expect(result.isOk()).toBe(true);
        expect(executeMock).toHaveBeenCalledWith({
            code: 'return 1 + 2;',
            timeoutMs: 1000,
        });
        if (result.isErr()) {
            throw new Error(result.error.message);
        }
        expect(result.value).toMatchObject({
            runtime: 'vendored_node',
            result: 3,
            timedOut: false,
        });
    });
});
