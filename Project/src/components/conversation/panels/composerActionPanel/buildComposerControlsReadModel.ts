import { reasoningEffortOptions } from '@/web/components/conversation/panels/composerActionPanel/helpers';
import type { ComposerActionPanelProps, ComposerControlsReadModel } from '@/web/components/conversation/panels/composerActionPanel/types';

export function buildComposerControlsReadModel(
    input: Pick<
        ComposerActionPanelProps,
        | 'disabled'
        | 'controlsDisabled'
        | 'submitDisabled'
        | 'topLevelTab'
        | 'selectedProviderId'
        | 'selectedModelSupportsReasoning'
        | 'supportedReasoningEfforts'
        | 'reasoningEffort'
        | 'selectedProviderStatus'
    >
): ComposerControlsReadModel {
    const composerControlsDisabled = input.controlsDisabled ?? input.disabled;
    const composerSubmitDisabled = input.submitDisabled ?? input.disabled;
    const shouldShowModePicker = input.topLevelTab !== 'chat';
    const isKiloReasoningModel = input.selectedProviderId === 'kilo' && input.selectedModelSupportsReasoning;
    const availableReasoningEfforts = input.selectedModelSupportsReasoning
        ? reasoningEffortOptions.filter((option) => {
              if (option.value === 'none') {
                  return true;
              }

              if (isKiloReasoningModel) {
                  return input.supportedReasoningEfforts?.includes(option.value) ?? false;
              }

              return (
                  input.supportedReasoningEfforts === undefined ||
                  input.supportedReasoningEfforts.includes(option.value)
              );
          })
        : reasoningEffortOptions.filter((option) => option.value === 'none');
    const hasAdjustableReasoningEfforts = availableReasoningEfforts.length > 1;
    const selectedReasoningEffort = availableReasoningEfforts.some((option) => option.value === input.reasoningEffort)
        ? input.reasoningEffort
        : 'none';

    return {
        composerControlsDisabled,
        composerSubmitDisabled,
        shouldShowModePicker,
        ...(input.selectedProviderStatus
            ? {
                  compactConnectionLabel: `${input.selectedProviderStatus.label} · ${input.selectedProviderStatus.authState.replace('_', ' ')}`,
              }
            : {}),
        availableReasoningEfforts,
        hasAdjustableReasoningEfforts,
        selectedReasoningEffort,
        reasoningControlDisabled:
            composerControlsDisabled ||
            !input.selectedModelSupportsReasoning ||
            !hasAdjustableReasoningEfforts,
    };
}
