import { normalizeModalities } from '@/app/backend/providers/behaviors/catalogCapabilities';
import type { ProviderCatalogBehavior } from '@/app/backend/providers/behaviors/types';

function isReasoningModelId(modelId: string): boolean {
    const normalized = modelId.toLowerCase();
    return (
        normalized.includes('codex') ||
        normalized.startsWith('openai/o1') ||
        normalized.startsWith('openai/o3') ||
        normalized.startsWith('openai/o4') ||
        normalized.startsWith('o1') ||
        normalized.startsWith('o3') ||
        normalized.startsWith('o4') ||
        normalized.includes('gpt-5')
    );
}

function isVisionModelId(modelId: string): boolean {
    const normalized = modelId.toLowerCase();
    return (
        normalized.includes('vision') ||
        normalized.includes('gpt-4o') ||
        normalized.includes('omni') ||
        normalized.includes('gpt-image')
    );
}

function isAudioModelId(modelId: string): boolean {
    const normalized = modelId.toLowerCase();
    return normalized.includes('audio') || normalized.includes('realtime');
}

function inferPromptFamily(modelId: string, promptFamily: string | undefined): string | undefined {
    if (promptFamily) {
        return promptFamily;
    }

    const normalized = modelId.toLowerCase();
    if (normalized.includes('codex')) {
        return 'codex';
    }

    return undefined;
}

export const openAICatalogBehavior: ProviderCatalogBehavior = {
    providerId: 'openai',
    createCapabilities(input) {
        const supportsReasoning = input.supportedParameters
            ? input.supportedParameters.includes('reasoning')
            : isReasoningModelId(input.modelId);
        const supportsTools = input.supportedParameters ? input.supportedParameters.includes('tools') : true;
        const inferredVision = isVisionModelId(input.modelId);
        const inferredAudio = isAudioModelId(input.modelId);
        const promptFamily = inferPromptFamily(input.modelId, input.promptFamily);
        const inputModalities = normalizeModalities(input.inputModalities ?? (inferredVision ? ['text', 'image'] : []));
        const outputModalities = normalizeModalities(
            input.outputModalities ?? (inferredAudio ? ['text', 'audio'] : [])
        );

        return {
            supportsTools,
            supportsReasoning,
            supportsVision: inputModalities.includes('image') || outputModalities.includes('image') || inferredVision,
            supportsAudioInput: inputModalities.includes('audio') || inferredAudio,
            supportsAudioOutput: outputModalities.includes('audio') || inferredAudio,
            inputModalities,
            outputModalities,
            ...(promptFamily ? { promptFamily } : {}),
        };
    },
};
