import { createHash } from 'node:crypto';

const CODE_PREVIEW_MAX_CHARS = 1_200;

function normalizePreview(code: string): string {
    const trimmed = code.trim();
    if (trimmed.length <= CODE_PREVIEW_MAX_CHARS) {
        return trimmed;
    }

    return `${trimmed.slice(0, CODE_PREVIEW_MAX_CHARS)}\n... truncated for approval preview ...`;
}

export function buildExecuteCodeResource(code: string): string {
    const digest = createHash('sha256').update(code).digest('hex').slice(0, 24);
    return `tool:execute_code:code:${digest}`;
}

export interface ExecuteCodeApprovalContext {
    codeText: string;
    codePreview: string;
    codeResource: string;
    codeDigest: string;
}

export function buildExecuteCodeApprovalContext(code: string): ExecuteCodeApprovalContext {
    const codeResource = buildExecuteCodeResource(code);
    return {
        codeText: code,
        codePreview: normalizePreview(code),
        codeResource,
        codeDigest: codeResource.slice('tool:execute_code:code:'.length),
    };
}
