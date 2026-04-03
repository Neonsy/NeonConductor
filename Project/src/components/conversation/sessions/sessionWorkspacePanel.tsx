import {
    buildWorkspaceShellProjection,
    type SessionWorkspacePanelProps,
} from '@/web/components/conversation/sessions/workspace/workspacePanelModel';
import { WorkspacePrimaryColumn } from '@/web/components/conversation/sessions/workspace/workspacePrimaryColumn';
import { WorkspaceSelectionHeader } from '@/web/components/conversation/sessions/workspace/workspaceSelectionHeader';
import { WorkspaceShell } from '@/web/components/conversation/sessions/workspace/workspaceShell';

export type { SessionWorkspacePanelProps } from '@/web/components/conversation/sessions/workspace/workspacePanelModel';

export function SessionWorkspacePanel(input: SessionWorkspacePanelProps) {
    const workspaceShell = input.workspaceShell ?? buildWorkspaceShellProjection(input);
    const {
        profileId,
        profiles,
        selectedProfileId,
        selectedWorkspaceFingerprint,
        selectedSandboxId,
        messages,
        partsByMessageId,
        runs,
        selectedSessionId,
        optimisticUserMessage,
        pendingImages,
        isStartingRun,
        selectedProviderId,
        selectedModelId,
        topLevelTab,
        activeModeKey,
        modes,
        reasoningEffort,
        selectedModelSupportsReasoning,
        supportedReasoningEfforts,
        maxImageAttachmentsPerMessage,
        canAttachImages,
        imageAttachmentBlockedReason,
        routingBadge,
        selectedModelCompatibilityState,
        selectedModelCompatibilityReason,
        selectedProviderStatus,
        modelOptions,
        runErrorMessage,
        contextState,
        attachedRules,
        missingAttachedRuleKeys,
        attachedSkills,
        missingAttachedSkillKeys,
        canCompactContext,
        isCompactingContext,
        promptResetKey,
        focusComposerRequestKey,
        controlsDisabled,
        submitDisabled,
        onSelectSession,
        onSelectRun,
        onProfileChange,
        onProviderChange,
        onModelChange,
        onReasoningEffortChange,
        onModeChange,
        onPromptEdited,
        onAddImageFiles,
        onRemovePendingImage,
        onRetryPendingImage,
        onSubmitPrompt,
        onCompactContext,
        onEditMessage,
        onBranchFromMessage,
        onOpenToolArtifact,
    } = input;

    return (
        <WorkspaceShell
            inspectorSections={workspaceShell.inspector.sections}
            renderHeader={({ isInspectorOpen, toggleInspector }) => (
                <WorkspaceSelectionHeader
                    selectedSession={workspaceShell.header.selectedSession}
                    selectedRun={workspaceShell.header.selectedRun}
                    {...(workspaceShell.header.compactConnectionLabel
                        ? { compactConnectionLabel: workspaceShell.header.compactConnectionLabel }
                        : {})}
                    {...(workspaceShell.header.routingBadge ? { routingBadge: workspaceShell.header.routingBadge } : {})}
                    pendingPermissionCount={workspaceShell.header.pendingPermissionCount}
                    isInspectorOpen={isInspectorOpen}
                    sessions={workspaceShell.header.sessions}
                    runs={workspaceShell.header.runs}
                    onSelectSession={onSelectSession}
                    onSelectRun={onSelectRun}
                    onToggleInspector={toggleInspector}
                />
            )}>
            <WorkspacePrimaryColumn
                profileId={profileId}
                profiles={profiles}
                messages={messages}
                partsByMessageId={partsByMessageId}
                runs={runs}
                pendingImages={pendingImages}
                isStartingRun={isStartingRun}
                selectedProviderId={selectedProviderId}
                selectedModelId={selectedModelId}
                topLevelTab={topLevelTab}
                activeModeKey={activeModeKey}
                modes={modes}
                reasoningEffort={reasoningEffort}
                selectedModelSupportsReasoning={selectedModelSupportsReasoning}
                maxImageAttachmentsPerMessage={maxImageAttachmentsPerMessage}
                canAttachImages={canAttachImages}
                modelOptions={modelOptions}
                runErrorMessage={runErrorMessage}
                attachedRules={attachedRules}
                missingAttachedRuleKeys={missingAttachedRuleKeys}
                attachedSkills={attachedSkills}
                missingAttachedSkillKeys={missingAttachedSkillKeys}
                {...(selectedProfileId ? { selectedProfileId } : {})}
                {...(selectedSessionId ? { selectedSessionId } : {})}
                {...(selectedWorkspaceFingerprint ? { selectedWorkspaceFingerprint } : {})}
                {...(selectedSandboxId ? { selectedSandboxId } : {})}
                {...(optimisticUserMessage ? { optimisticUserMessage } : {})}
                {...(supportedReasoningEfforts ? { supportedReasoningEfforts } : {})}
                {...(imageAttachmentBlockedReason ? { imageAttachmentBlockedReason } : {})}
                {...(routingBadge !== undefined ? { routingBadge } : {})}
                {...(selectedModelCompatibilityState ? { selectedModelCompatibilityState } : {})}
                {...(selectedModelCompatibilityReason ? { selectedModelCompatibilityReason } : {})}
                {...(selectedProviderStatus ? { selectedProviderStatus } : {})}
                {...(contextState ? { contextState } : {})}
                {...(canCompactContext !== undefined ? { canCompactContext } : {})}
                {...(isCompactingContext !== undefined ? { isCompactingContext } : {})}
                {...(promptResetKey !== undefined ? { promptResetKey } : {})}
                {...(focusComposerRequestKey !== undefined ? { focusComposerRequestKey } : {})}
                {...(controlsDisabled !== undefined ? { controlsDisabled } : {})}
                {...(submitDisabled !== undefined ? { submitDisabled } : {})}
                onProfileChange={onProfileChange}
                onProviderChange={onProviderChange}
                onModelChange={onModelChange}
                onReasoningEffortChange={onReasoningEffortChange}
                onModeChange={onModeChange}
                onPromptEdited={onPromptEdited}
                onAddImageFiles={onAddImageFiles}
                onRemovePendingImage={onRemovePendingImage}
                onRetryPendingImage={onRetryPendingImage}
                onSubmitPrompt={onSubmitPrompt}
                {...(onCompactContext ? { onCompactContext } : {})}
                {...(onEditMessage ? { onEditMessage } : {})}
                {...(onBranchFromMessage ? { onBranchFromMessage } : {})}
                {...(onOpenToolArtifact ? { onOpenToolArtifact } : {})}
            />
        </WorkspaceShell>
    );
}
