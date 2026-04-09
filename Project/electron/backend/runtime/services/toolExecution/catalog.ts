import type { ToolRecord } from '@/app/backend/persistence/types';

const TOOL_SAFETY_METADATA: Record<
    string,
    Pick<ToolRecord, 'capabilities' | 'requiresWorkspace' | 'allowsExternalPaths' | 'allowsIgnoredPaths' | 'mutability'>
> = {
    read_file: {
        capabilities: ['filesystem_read'],
        mutability: 'read_only',
        requiresWorkspace: true,
        allowsExternalPaths: false,
        allowsIgnoredPaths: false,
    },
    list_files: {
        capabilities: ['filesystem_read'],
        mutability: 'read_only',
        requiresWorkspace: true,
        allowsExternalPaths: false,
        allowsIgnoredPaths: false,
    },
    search_files: {
        capabilities: ['filesystem_read'],
        mutability: 'read_only',
        requiresWorkspace: true,
        allowsExternalPaths: false,
        allowsIgnoredPaths: false,
    },
    write_file: {
        capabilities: ['filesystem_write'],
        mutability: 'mutating',
        requiresWorkspace: true,
        allowsExternalPaths: false,
        allowsIgnoredPaths: false,
    },
    run_command: {
        capabilities: ['shell'],
        mutability: 'mutating',
        requiresWorkspace: true,
        allowsExternalPaths: false,
        allowsIgnoredPaths: false,
    },
    execute_code: {
        capabilities: ['code_runtime'],
        mutability: 'mutating',
        requiresWorkspace: true,
        allowsExternalPaths: false,
        allowsIgnoredPaths: false,
    },
};

export function getToolSafetyMetadata(
    toolId: string
): Pick<
    ToolRecord,
    'capabilities' | 'requiresWorkspace' | 'allowsExternalPaths' | 'allowsIgnoredPaths' | 'mutability'
> {
    return (
        TOOL_SAFETY_METADATA[toolId] ?? {
            capabilities: [],
            mutability: 'mutating',
            requiresWorkspace: false,
            allowsExternalPaths: false,
            allowsIgnoredPaths: false,
        }
    );
}
