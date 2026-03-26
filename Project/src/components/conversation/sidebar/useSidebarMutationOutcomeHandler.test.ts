import { describe, expect, it } from 'vitest';

import { resolveSidebarSelectionAfterMutation } from '@/web/components/conversation/sidebar/useSidebarMutationOutcomeHandler';

describe('resolveSidebarSelectionAfterMutation', () => {
    it('clears thread, session, and run when the selected thread was deleted', () => {
        const result = resolveSidebarSelectionAfterMutation({
            selectedThreadId: 'thr_selected',
            selectedSessionId: 'sess_selected',
            selectedRunId: 'run_selected',
            selectedThread: {
                id: 'thr_selected',
                profileId: 'profile_default',
                conversationId: 'conv_workspace',
                title: 'Selected thread',
                topLevelTab: 'agent',
                rootThreadId: 'thr_selected',
                isFavorite: false,
                executionEnvironmentMode: 'local',
                scope: 'workspace',
                workspaceFingerprint: 'ws_alpha',
                anchorKind: 'workspace',
                anchorId: 'ws_alpha',
                sessionCount: 1,
                createdAt: '2026-03-26T10:00:00.000Z',
                updatedAt: '2026-03-26T10:00:00.000Z',
            },
            outcome: {
                kind: 'deleted_workspace_threads',
                workspaceFingerprint: 'ws_alpha',
                deletedThreadIds: ['thr_selected'],
                deletedSessionIds: [],
                deletedConversationIds: ['conv_workspace'],
                deletedTagIds: [],
            },
        });

        expect(result).toEqual({
            selectedThreadId: undefined,
            selectedSessionId: undefined,
            selectedRunId: undefined,
        });
    });

    it('clears only session and run when threads were deleted in the selected workspace but the selected thread survives', () => {
        const result = resolveSidebarSelectionAfterMutation({
            selectedThreadId: 'thr_selected',
            selectedSessionId: 'sess_selected',
            selectedRunId: 'run_selected',
            selectedThread: {
                id: 'thr_selected',
                profileId: 'profile_default',
                conversationId: 'conv_workspace',
                title: 'Selected thread',
                topLevelTab: 'agent',
                rootThreadId: 'thr_selected',
                isFavorite: false,
                executionEnvironmentMode: 'local',
                scope: 'workspace',
                workspaceFingerprint: 'ws_alpha',
                anchorKind: 'workspace',
                anchorId: 'ws_alpha',
                sessionCount: 1,
                createdAt: '2026-03-26T10:00:00.000Z',
                updatedAt: '2026-03-26T10:00:00.000Z',
            },
            outcome: {
                kind: 'deleted_workspace_threads',
                workspaceFingerprint: 'ws_alpha',
                deletedThreadIds: ['thr_other'],
                deletedSessionIds: ['sess_other'],
                deletedConversationIds: ['conv_other'],
                deletedTagIds: [],
            },
        });

        expect(result).toEqual({
            selectedThreadId: 'thr_selected',
            selectedSessionId: undefined,
            selectedRunId: undefined,
        });
    });
});
