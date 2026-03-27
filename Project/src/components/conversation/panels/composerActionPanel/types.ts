import type { ConversationModeOption } from '@/web/components/conversation/shell/workspace/helpers';
import type { ModelCompatibilityState, ModelPickerOption } from '@/web/components/modelSelection/modelCapabilities';
import type { PendingImageCardView } from '@/web/components/conversation/panels/composerActionPanel/pendingImagesGrid';

import type {
    EntityId,
    ResolvedContextState,
    RulesetDefinition,
    RuntimeReasoningEffort,
    SkillfileDefinition,
    TopLevelTab,
} from '@/shared/contracts';

export type PendingImageView = PendingImageCardView;

export interface ComposerActionFeedback {
    message: string;
    tone: 'success' | 'error' | 'info';
}

export interface ComposerActionPanelProps {
    profileId: string;
    pendingImages: PendingImageView[];
    disabled: boolean;
    controlsDisabled?: boolean;
    submitDisabled?: boolean;
    isSubmitting: boolean;
    profiles?: Array<{ id: string; name: string }>;
    selectedProfileId?: string;
    selectedProviderId: string | undefined;
    selectedModelId: string | undefined;
    topLevelTab: TopLevelTab;
    activeModeKey: string;
    modes: ConversationModeOption[];
    reasoningEffort: RuntimeReasoningEffort;
    selectedModelSupportsReasoning: boolean;
    supportedReasoningEfforts?: RuntimeReasoningEffort[];
    canAttachImages: boolean;
    maxImageAttachmentsPerMessage: number;
    imageAttachmentBlockedReason?: string;
    routingBadge?: string;
    selectedModelCompatibilityState?: ModelCompatibilityState;
    selectedModelCompatibilityReason?: string;
    selectedProviderStatus?: {
        label: string;
        authState: string;
        authMethod: string;
    };
    modelOptions: ModelPickerOption[];
    runErrorMessage: string | undefined;
    contextState?: ResolvedContextState;
    selectedSessionId?: EntityId<'sess'>;
    workspaceFingerprint?: string;
    sandboxId?: EntityId<'sb'>;
    attachedRules?: RulesetDefinition[];
    missingAttachedRuleKeys?: string[];
    attachedSkills?: SkillfileDefinition[];
    missingAttachedSkillKeys?: string[];
    canCompactContext?: boolean;
    isCompactingContext?: boolean;
    promptResetKey?: number;
    focusComposerRequestKey?: number;
    onProfileChange?: (profileId: string) => void;
    onProviderChange: (providerId: string) => void;
    onModelChange: (modelId: string) => void;
    onReasoningEffortChange: (effort: RuntimeReasoningEffort) => void;
    onModeChange: (modeKey: string) => void;
    onPromptEdited: () => void;
    onAddImageFiles: (files: FileList | File[]) => void;
    onRemovePendingImage: (clientId: string) => void;
    onRetryPendingImage: (clientId: string) => void;
    onSubmitPrompt: (prompt: string) => void;
    onCompactContext?: () => Promise<ComposerActionFeedback | undefined>;
}

export interface ComposerControlsReadModel {
    composerControlsDisabled: boolean;
    composerSubmitDisabled: boolean;
    shouldShowModePicker: boolean;
    compactConnectionLabel?: string;
    availableReasoningEfforts: Array<{ value: RuntimeReasoningEffort; label: string }>;
    hasAdjustableReasoningEfforts: boolean;
    selectedReasoningEffort: RuntimeReasoningEffort;
    reasoningControlDisabled: boolean;
}

export interface ComposerSubmissionPolicy {
    hasBlockingPendingImages: boolean;
    hasSubmittableContent: boolean;
    hasUnsupportedPendingImages: boolean;
    canSubmit: boolean;
    attachmentStatusMessage: string;
    composerFooterMessage: string;
    composerErrorMessage: string | undefined;
}

export interface ComposerLightboxState {
    imageUrl: string;
    title: string;
    detail?: string;
}
