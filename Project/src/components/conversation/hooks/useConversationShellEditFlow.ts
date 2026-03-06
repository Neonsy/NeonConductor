import { useState } from 'react';

import type { ConversationUiState } from '@/web/components/conversation/hooks/useConversationUiState';
import type { MessageTimelineEntry } from '@/web/components/conversation/messageTimelineModel';
import { createPendingMessageEdit } from '@/web/components/conversation/pendingMessageEdit';
import { toEditFailureMessage, type PendingMessageEdit } from '@/web/components/conversation/shellEditFlow';
import { DEFAULT_RUN_OPTIONS, isEntityId } from '@/web/components/conversation/shellHelpers';
import { trpc } from '@/web/trpc/client';

import type { ThreadListRecord } from '@/app/backend/persistence/types';
import type { RuntimeProviderId, SessionEditInput, TopLevelTab } from '@/app/backend/runtime/contracts';

interface UseConversationShellEditFlowInput {
    profileId: string;
    topLevelTab: TopLevelTab;
    modeKey: string;
    selectedSessionId: string | undefined;
    selectedThread: ThreadListRecord | undefined;
    resolvedRunTarget:
        | {
              providerId: RuntimeProviderId;
              modelId: string;
          }
        | undefined;
    editSession: (input: SessionEditInput) => Promise<
        | { edited: false; reason: string }
        | {
              edited: true;
              sessionId: string;
              sourceSessionId: string;
              editMode: 'truncate' | 'branch';
              started: boolean;
              runId?: string;
              threadId?: string;
              topLevelTab?: TopLevelTab;
          }
    >;
    setEditPreference: (input: { profileId: string; value: 'truncate' | 'branch' }) => Promise<unknown>;
    uiState: ConversationUiState;
    onTopLevelTabChange: (nextTab: TopLevelTab) => void;
    onClearError: () => void;
    onError: (message: string) => void;
    onPromptReset: () => void;
    refetchSessionWorkspace: () => void;
}

export function useConversationShellEditFlow(input: UseConversationShellEditFlowInput) {
    const [pendingMessageEdit, setPendingMessageEdit] = useState<PendingMessageEdit | undefined>(undefined);
    const editPreferenceQuery = trpc.conversation.getEditPreference.useQuery(
        {
            profileId: input.profileId,
        },
        {
            refetchOnWindowFocus: false,
        }
    );

    const editPreference: 'ask' | 'truncate' | 'branch' =
        editPreferenceQuery.data?.value === 'truncate' || editPreferenceQuery.data?.value === 'branch'
            ? editPreferenceQuery.data.value
            : 'ask';

    return {
        pendingMessageEdit,
        editPreference,
        resetEditFlow: () => {
            setPendingMessageEdit(undefined);
        },
        onEditMessage: (entry: MessageTimelineEntry) => {
            const pendingEdit = createPendingMessageEdit(entry);
            if (pendingEdit) {
                setPendingMessageEdit(pendingEdit);
            }
        },
        onBranchFromMessage: (entry: MessageTimelineEntry) => {
            const pendingEdit = createPendingMessageEdit(entry, 'branch');
            if (pendingEdit) {
                setPendingMessageEdit(pendingEdit);
            }
        },
        dialogProps: {
            open: Boolean(pendingMessageEdit),
            initialText: pendingMessageEdit?.initialText ?? '',
            preferredResolution: editPreference,
            ...(pendingMessageEdit?.forcedMode ? { forcedMode: pendingMessageEdit.forcedMode } : {}),
            onCancel: () => {
                setPendingMessageEdit(undefined);
            },
            onSave: (dialogInput: {
                replacementText: string;
                editMode: 'truncate' | 'branch';
                rememberChoice: boolean;
            }) => {
                if (!pendingMessageEdit) {
                    return;
                }
                if (!isEntityId(input.selectedSessionId, 'sess')) {
                    input.onError('Select a session before editing a message.');
                    return;
                }

                input.onClearError();
                void input.editSession({
                    profileId: input.profileId,
                    sessionId: input.selectedSessionId,
                    topLevelTab: input.topLevelTab,
                    modeKey: input.modeKey,
                    messageId: pendingMessageEdit.messageId,
                    replacementText: dialogInput.replacementText,
                    editMode: dialogInput.editMode,
                    autoStartRun: true,
                    runtimeOptions: DEFAULT_RUN_OPTIONS,
                    ...(input.resolvedRunTarget ? { providerId: input.resolvedRunTarget.providerId } : {}),
                    ...(input.resolvedRunTarget ? { modelId: input.resolvedRunTarget.modelId } : {}),
                    ...(input.selectedThread?.workspaceFingerprint
                        ? { workspaceFingerprint: input.selectedThread.workspaceFingerprint }
                        : {}),
                })
                    .then(async (result) => {
                        if (!result.edited) {
                            input.onError(toEditFailureMessage(result.reason));
                            return;
                        }

                        if (dialogInput.rememberChoice && editPreference === 'ask') {
                            await input.setEditPreference({
                                profileId: input.profileId,
                                value: dialogInput.editMode,
                            });
                            void editPreferenceQuery.refetch();
                        }

                        if (result.threadId && isEntityId(result.threadId, 'thr')) {
                            input.uiState.setSelectedThreadId(result.threadId);
                        }
                        if (result.topLevelTab && result.topLevelTab !== input.topLevelTab) {
                            input.onTopLevelTabChange(result.topLevelTab);
                        }
                        input.uiState.setSelectedSessionId(result.sessionId);
                        if (result.runId) {
                            input.uiState.setSelectedRunId(result.runId);
                        } else {
                            input.uiState.setSelectedRunId(undefined);
                        }
                        setPendingMessageEdit(undefined);
                        input.onPromptReset();
                        input.refetchSessionWorkspace();
                    })
                    .catch((error: unknown) => {
                        const message = error instanceof Error ? error.message : String(error);
                        input.onError(`Edit failed: ${message}`);
                    });
            },
        },
    };
}
