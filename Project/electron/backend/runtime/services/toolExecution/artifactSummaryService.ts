import type { RuntimeProviderId } from '@/app/backend/runtime/contracts';
import { generatePlainTextFromMessages } from '@/app/backend/runtime/services/common/plainTextGeneration';
import { resolveSummaryGenerationTarget } from '@/app/backend/runtime/services/common/summaryGenerationTarget';
import { createTextMessage } from '@/app/backend/runtime/services/runExecution/contextParts';
import type { ToolExecutionArtifactCandidate } from '@/app/backend/runtime/services/toolExecution/types';
import { appLog } from '@/app/main/logging';

const COMMAND_OUTPUT_SUMMARY_SYSTEM_PROMPT = [
    'You summarize command execution artifacts for future model turns.',
    'Return compact markdown only.',
    'Start with one short heading line, then 4-8 bullets.',
    'Capture the command, cwd, exit status or timeout, key stdout findings, key stderr findings, concrete errors or warnings, relevant files or symbols, and the next inspection target only when it is obvious from the output.',
    'Do not include large verbatim logs, repeated lines, or boilerplate success noise.',
].join(' ');

const COMMAND_OUTPUT_SUMMARY_MAX_CHARS = 1_500;

export type ArtifactSummaryMode = 'deterministic' | 'utility_ai';

export type ArtifactSummaryResult =
    | {
          kind: 'not_eligible';
      }
    | {
          kind: 'fallback_deterministic';
          reason: 'no_usable_target' | 'generation_failed';
      }
    | {
          kind: 'summary_generated';
          summaryText: string;
          providerId: RuntimeProviderId;
          modelId: string;
          source: 'utility' | 'fallback';
      };

function normalizeSummaryText(summaryText: string): string {
    const normalized = summaryText.replace(/\r\n/g, '\n').trim();
    if (normalized.length <= COMMAND_OUTPUT_SUMMARY_MAX_CHARS) {
        return normalized;
    }

    const lines = normalized.split('\n');
    let trimmed = '';
    for (const line of lines) {
        const next = trimmed.length === 0 ? line : `${trimmed}\n${line}`;
        if (next.length > COMMAND_OUTPUT_SUMMARY_MAX_CHARS - 1) {
            break;
        }
        trimmed = next;
    }

    const fallback = trimmed.trim().length > 0 ? trimmed.trimEnd() : normalized.slice(0, COMMAND_OUTPUT_SUMMARY_MAX_CHARS - 1).trimEnd();
    return `${fallback}…`;
}

function buildCommandOutputSummaryMessages(candidate: Extract<ToolExecutionArtifactCandidate, { kind: 'command_output' }>) {
    return [
        createTextMessage('system', COMMAND_OUTPUT_SUMMARY_SYSTEM_PROMPT),
        createTextMessage(
            'user',
            [
                'Summarize this command execution artifact for future model turns.',
                'Keep it concise and action-oriented.',
                'Artifact JSON:',
                candidate.rawText,
            ].join('\n\n')
        ),
    ];
}

class ArtifactSummaryService {
    async summarizeArtifact(input: {
        profileId: string;
        fallbackProviderId: RuntimeProviderId;
        fallbackModelId: string;
        artifactCandidate: ToolExecutionArtifactCandidate;
    }): Promise<ArtifactSummaryResult> {
        if (input.artifactCandidate.kind !== 'command_output') {
            return {
                kind: 'not_eligible',
            };
        }

        const summaryMessages = buildCommandOutputSummaryMessages(input.artifactCandidate);
        const target = await resolveSummaryGenerationTarget({
            profileId: input.profileId,
            fallbackProviderId: input.fallbackProviderId,
            fallbackModelId: input.fallbackModelId,
            summaryMessages,
            requireFallbackFit: true,
        });
        if (!target) {
            appLog.debug({
                tag: 'tool-output-artifacts',
                message: 'Fell back to deterministic tool artifact preview because no summary target could fit the artifact request.',
                profileId: input.profileId,
                artifactKind: input.artifactCandidate.kind,
                fallbackProviderId: input.fallbackProviderId,
                fallbackModelId: input.fallbackModelId,
            });
            return {
                kind: 'fallback_deterministic',
                reason: 'no_usable_target',
            };
        }

        const generated = await generatePlainTextFromMessages({
            profileId: input.profileId,
            providerId: target.providerId,
            modelId: target.modelId,
            messages: summaryMessages,
            timeoutMs: 15_000,
        });
        if (generated.isErr()) {
            appLog.debug({
                tag: 'tool-output-artifacts',
                message: 'Fell back to deterministic tool artifact preview because semantic artifact summarization failed.',
                profileId: input.profileId,
                artifactKind: input.artifactCandidate.kind,
                providerId: target.providerId,
                modelId: target.modelId,
                source: target.source,
                error: generated.error.message,
            });
            return {
                kind: 'fallback_deterministic',
                reason: 'generation_failed',
            };
        }

        return {
            kind: 'summary_generated',
            summaryText: normalizeSummaryText(generated.value),
            providerId: target.providerId,
            modelId: target.modelId,
            source: target.source,
        };
    }
}

export const artifactSummaryService = new ArtifactSummaryService();
