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
        onCreateSession,
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
                    sessions={workspaceShell.header.sessions}
                    runs={workspaceShell.header.runs}
                    selectedSession={workspaceShell.header.selectedSession}
                    selectedRun={workspaceShell.header.selectedRun}
                    {...(workspaceShell.header.compactConnectionLabel
                        ? { compactConnectionLabel: workspaceShell.header.compactConnectionLabel }
                        : {})}
                    {...(workspaceShell.header.routingBadge ? { routingBadge: workspaceShell.header.routingBadge } : {})}
                    pendingPermissionCount={workspaceShell.header.pendingPermissionCount}
                    canCreateSession={workspaceShell.header.canCreateSession}
                    isCreatingSession={workspaceShell.header.isCreatingSession}
                    isInspectorOpen={isInspectorOpen}
                    onCreateSession={onCreateSession}
                    onSelectSession={onSelectSession}
                    onSelectRun={onSelectRun}
                    onToggleInspector={toggleInspector}
                />
            )}>
            <WorkspacePrimaryColumn
                profileId={profileId}
                profiles={profiles}
                selectedProfileId={selectedProfileId}
                selectedSessionId={selectedSessionId}
                selectedWorkspaceFingerprint={selectedWorkspaceFingerprint}
                selectedSandboxId={selectedSandboxId}
                messages={messages}
                partsByMessageId={partsByMessageId}
                runs={runs}
                optimisticUserMessage={optimisticUserMessage}
                pendingImages={pendingImages}
                isStartingRun={isStartingRun}
                selectedProviderId={selectedProviderId}
                selectedModelId={selectedModelId}
                topLevelTab={topLevelTab}
                activeModeKey={activeModeKey}
                modes={modes}
                reasoningEffort={reasoningEffort}
                selectedModelSupportsReasoning={selectedModelSupportsReasoning}
                supportedReasoningEfforts={supportedReasoningEfforts}
                maxImageAttachmentsPerMessage={maxImageAttachmentsPerMessage}
                canAttachImages={canAttachImages}
                imageAttachmentBlockedReason={imageAttachmentBlockedReason}
                routingBadge={routingBadge}
                selectedModelCompatibilityState={selectedModelCompatibilityState}
                selectedModelCompatibilityReason={selectedModelCompatibilityReason}
                selectedProviderStatus={selectedProviderStatus}
                modelOptions={modelOptions}
                runErrorMessage={runErrorMessage}
                contextState={contextState}
                attachedRules={attachedRules}
                missingAttachedRuleKeys={missingAttachedRuleKeys}
                attachedSkills={attachedSkills}
                missingAttachedSkillKeys={missingAttachedSkillKeys}
                canCompactContext={canCompactContext}
                isCompactingContext={isCompactingContext}
                promptResetKey={promptResetKey}
                focusComposerRequestKey={focusComposerRequestKey}
                controlsDisabled={controlsDisabled}
                submitDisabled={submitDisabled}
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
                onCompactContext={onCompactContext}
                onEditMessage={onEditMessage}
                onBranchFromMessage={onBranchFromMessage}
                onOpenToolArtifact={onOpenToolArtifact}
            />
        </WorkspaceShell>
    );
}
