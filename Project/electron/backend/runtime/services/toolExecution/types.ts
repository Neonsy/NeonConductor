import type { ToolRecord } from '@/app/backend/persistence/types';

export interface ToolOutputEntry {
    path: string;
    kind: 'file' | 'directory';
}

export interface ToolExecutionFailure {
    code: 'invalid_args' | 'not_implemented' | 'execution_failed';
    message: string;
}

export type ToolExecutionOutput = Record<string, unknown>;

export type ToolExecutionResult =
    | {
          ok: true;
          toolId: string;
          output: ToolExecutionOutput;
          at: string;
          policy: { effective: 'ask' | 'allow' | 'deny'; source: string };
      }
    | {
          ok: false;
          toolId: string;
          error:
              | 'tool_not_found'
              | 'policy_denied'
              | 'permission_required'
              | 'invalid_args'
              | 'not_implemented'
              | 'execution_failed';
          message: string;
          args: Record<string, unknown>;
          at: string;
          policy?: { effective: 'ask' | 'allow' | 'deny'; source: string };
          requestId?: string;
      };

export interface ResolvedToolDefinition {
    tool: ToolRecord;
    resource: string;
    source: 'native' | 'mcp';
    mcpServerId?: string;
    mcpToolName?: string;
}
