import { ComposerActionPanel } from '@/web/components/conversation/panels/composerActionPanel';
import { MessageFlowPanel } from '@/web/components/conversation/panels/messageFlowPanel';
import type { SessionWorkspacePanelProps } from '@/web/components/conversation/sessions/workspace/workspacePanelModel';
import { isEntityId } from '@/web/components/conversation/shell/workspace/helpers';

type WorkspacePrimaryColumnProps = Pick<
    SessionWorkspacePanelProps,
    | 'profileId'
    | 'profiles'
    | 'selectedProfileId'
    | 'selectedSessionId'
    | 'selectedWorkspaceFingerprint'
    | 'selectedSandboxId'
    | 'messages'
    | 'partsByMessageId'
    | 'runs'
    | 'optimisticUserMessage'
    | 'pendingImages'
    | 'isStartingRun'
    | 'selectedProviderId'
    | 'selectedModelId'
    | 'topLevelTab'
    | 'activeModeKey'
    | 'modes'
    | 'reasoningEffort'
    | 'selectedModelSupportsReasoning'
    | 'supportedReasoningEfforts'
    | 'maxImageAttachmentsPerMessage'
    | 'canAttachImages'
    | 'imageAttachmentBlockedReason'
    | 'routingBadge'
    | 'selectedModelCompatibilityState'
    | 'selectedModelCompatibilityReason'
    | 'selectedProviderStatus'
    | 'modelOptions'
    | 'runErrorMessage'
    | 'contextState'
    | 'attachedRules'
    | 'missingAttachedRuleKeys'
    | 'attachedSkills'
    | 'missingAttachedSkillKeys'
    | 'canCompactContext'
    | 'isCompactingContext'
    | 'promptResetKey'
    | 'focusComposerRequestKey'
    | 'controlsDisabled'
    | 'submitDisabled'
    | 'onProfileChange'
    | 'onProviderChange'
    | 'onModelChange'
    | 'onReasoningEffortChange'
    | 'onModeChange'
    | 'onPromptEdited'
    | 'onAddImageFiles'
    | 'onRemovePendingImage'
    | 'onRetryPendingImage'
    | 'onSubmitPrompt'
    | 'onCompactContext'
    | 'onEditMessage'
    | 'onBranchFromMessage'
    | 'onOpenToolArtifact'
>;

export function WorkspacePrimaryColumn({
    profileId,
    profiles,
    selectedProfileId,
    selectedSessionId,
    selectedWorkspaceFingerprint,
    selectedSandboxId,
    messages,
    partsByMessageId,
    runs,
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
}: WorkspacePrimaryColumnProps) {
    const validatedSelectedSessionId = isEntityId(selectedSessionId, 'sess') ? selectedSessionId : undefined;

    return (
        <div className='flex min-h-0 min-w-0 flex-col overflow-hidden'>
            <div className='flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-4 py-4'>
                <div className='border-border/70 bg-card/15 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[34px] border shadow-[0_16px_44px_rgba(15,23,42,0.06)]'>
                    <div className='border-border/50 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[34px] border-dashed p-3 md:p-4'>
                        <MessageFlowPanel
                            profileId={profileId}
                            messages={messages}
                            partsByMessageId={partsByMessageId}
                            runs={runs}
                            {...(validatedSelectedSessionId ? { selectedSessionId: validatedSelectedSessionId } : {})}
                            {...(optimisticUserMessage ? { optimisticUserMessage } : {})}
                            {...(onEditMessage ? { onEditMessage } : {})}
                            {...(onBranchFromMessage ? { onBranchFromMessage } : {})}
                            {...(onOpenToolArtifact ? { onOpenToolArtifact } : {})}
                        />
                    </div>
                </div>

                <ComposerActionPanel
                    profileId={profileId}
                    pendingImages={pendingImages}
                    disabled={false}
                    isSubmitting={isStartingRun}
                    profiles={profiles}
                    {...(selectedProfileId ? { selectedProfileId } : {})}
                    selectedProviderId={selectedProviderId}
                    selectedModelId={selectedModelId}
                    topLevelTab={topLevelTab}
                    activeModeKey={activeModeKey}
                    modes={modes}
                    reasoningEffort={reasoningEffort}
                    selectedModelSupportsReasoning={selectedModelSupportsReasoning}
                    {...(supportedReasoningEfforts ? { supportedReasoningEfforts } : {})}
                    maxImageAttachmentsPerMessage={maxImageAttachmentsPerMessage}
                    canAttachImages={canAttachImages}
                    {...(imageAttachmentBlockedReason ? { imageAttachmentBlockedReason } : {})}
                    {...(routingBadge !== undefined ? { routingBadge } : {})}
                    {...(selectedModelCompatibilityState ? { selectedModelCompatibilityState } : {})}
                    {...(selectedModelCompatibilityReason ? { selectedModelCompatibilityReason } : {})}
                    {...(selectedProviderStatus ? { selectedProviderStatus } : {})}
                    modelOptions={modelOptions}
                    runErrorMessage={runErrorMessage}
                    {...(contextState ? { contextState } : {})}
                    {...(validatedSelectedSessionId ? { selectedSessionId: validatedSelectedSessionId } : {})}
                    {...(selectedWorkspaceFingerprint ? { workspaceFingerprint: selectedWorkspaceFingerprint } : {})}
                    {...(selectedSandboxId ? { sandboxId: selectedSandboxId } : {})}
                    attachedRules={attachedRules}
                    missingAttachedRuleKeys={missingAttachedRuleKeys}
                    attachedSkills={attachedSkills}
                    missingAttachedSkillKeys={missingAttachedSkillKeys}
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
                />
            </div>
        </div>
    );
}
