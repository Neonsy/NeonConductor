import { describe, expect, it } from 'vitest';

import {
    builtInRuntimeToolContracts,
    getBuiltInRuntimeToolContract,
} from '@/app/backend/runtime/services/runExecution/builtInRuntimeToolContracts';

describe('builtInRuntimeToolContracts', () => {
    it('defines the execute_code runtime contract', () => {
        const contract = getBuiltInRuntimeToolContract('execute_code');

        expect(contract).toMatchObject({
            id: 'execute_code',
            descriptionKind: 'execute_code',
            implemented: true,
        });
        expect(contract?.inputSchema).toMatchObject({
            type: 'object',
            additionalProperties: false,
            required: ['code'],
            properties: {
                code: {
                    type: 'string',
                },
                timeoutMs: {
                    type: 'number',
                },
            },
        });
    });

    it('keeps active built-in contracts implemented and deliberately ordered', () => {
        expect(
            builtInRuntimeToolContracts.filter((contract) => contract.implemented).map((contract) => contract.id)
        ).toEqual(['list_files', 'read_file', 'search_files', 'write_file', 'run_command', 'execute_code']);
    });
});
