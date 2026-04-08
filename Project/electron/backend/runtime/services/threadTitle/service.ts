import { providerStore, runStore, settingsStore, threadStore } from '@/app/backend/persistence/stores';
import type { RuntimeProviderId } from '@/app/backend/runtime/contracts';
import { generatePlainTextFromMessages } from '@/app/backend/runtime/services/common/plainTextGeneration';
import { utilityModelConsumerPreferencesService } from '@/app/backend/runtime/services/profile/utilityModelConsumerPreferences';
import { utilityModelService } from '@/app/backend/runtime/services/profile/utilityModel';
import { createTextMessage } from '@/app/backend/runtime/services/runExecution/contextParts';
import { appLog } from '@/app/main/logging';

const TITLE_GENERATION_MODE_KEY = 'thread_title_generation_mode';
const TITLE_AI_MODE = 'utility_refine';
const DEFAULT_TITLE_MODE = 'template';

function providerLabel(providerId: RuntimeProviderId): string {
    if (providerId === 'openai') {
        return 'OpenAI';
    }
    if (providerId === 'zai') {
        return 'Z.AI';
    }
    if (providerId === 'moonshot') {
        return 'Moonshot';
    }

    return 'Kilo';
}

function normalizeWhitespace(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

function truncate(value: string, maxLength: number): string {
    const normalized = normalizeWhitespace(value);
    if (normalized.length <= maxLength) {
        return normalized;
    }
    return `${normalized.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`;
}

function sanitizeTitle(value: string): string {
    const singleLine = value.replace(/\r?\n/g, ' ').replace(/^["'`\s]+|["'`\s]+$/g, '');
    return truncate(singleLine, 90);
}

function shouldRetitleThread(input: { title: string; runCount: number; parentThreadId?: string }): boolean {
    if (input.title.startsWith('New ')) {
        return true;
    }
    if (input.parentThreadId && input.title.endsWith('(Branch)')) {
        return true;
    }
    return false;
}

interface ApplyThreadTitleInput {
    profileId: string;
    sessionId: string;
    prompt: string;
    providerId: RuntimeProviderId;
    modelId: string;
}

async function buildTemplateTitle(input: {
    profileId: string;
    providerId: RuntimeProviderId;
    modelId: string;
    prompt: string;
}): Promise<string> {
    const models = await providerStore.listModels(input.profileId, input.providerId);
    const modelLabel = models.find((model) => model.id === input.modelId)?.label ?? input.modelId;
    const excerpt = truncate(input.prompt, 64);
    return sanitizeTitle(`${providerLabel(input.providerId)} · ${modelLabel} — ${excerpt}`);
}

async function generateAiTitle(input: {
    profileId: string;
    providerId: RuntimeProviderId;
    modelId: string;
    prompt: string;
    templateTitle: string;
}): Promise<string | undefined> {
    const modelExists = await providerStore.modelExists(input.profileId, input.providerId, input.modelId);
    if (!modelExists) {
        return undefined;
    }

    const generationResult = await generatePlainTextFromMessages({
        profileId: input.profileId,
        providerId: input.providerId,
        modelId: input.modelId,
        promptText: 'Return a concise thread title (max 70 chars) based on the user request. Return title text only.',
        messages: [
            createTextMessage('system', 'You produce short, clear conversation thread titles. Output plain text only.'),
            createTextMessage('user', `Request: ${input.prompt}\nTemplate: ${input.templateTitle}`),
        ],
    });
    if (generationResult.isErr()) {
        return undefined;
    }

    const candidate = sanitizeTitle(generationResult.value);
    if (candidate.length < 3) {
        return undefined;
    }
    return candidate;
}

class ThreadTitleService {
    async maybeApply(input: ApplyThreadTitleInput): Promise<void> {
        try {
            const [sessionThread, modelExists, modeRaw] = await Promise.all([
                threadStore.getBySessionId(input.profileId, input.sessionId),
                providerStore.modelExists(input.profileId, input.providerId, input.modelId),
                settingsStore.getStringOptional(input.profileId, TITLE_GENERATION_MODE_KEY),
            ]);
            if (!sessionThread) {
                return;
            }
            if (!modelExists) {
                return;
            }

            const allRuns = await runStore.listBySession(input.profileId, input.sessionId);

            if (
                !shouldRetitleThread({
                    title: sessionThread.thread.title,
                    runCount: allRuns.length,
                    ...(sessionThread.thread.parentThreadId
                        ? { parentThreadId: sessionThread.thread.parentThreadId }
                        : {}),
                })
            ) {
                return;
            }

            const templateTitle = await buildTemplateTitle({
                profileId: input.profileId,
                providerId: input.providerId,
                modelId: input.modelId,
                prompt: input.prompt,
            });
            const renamedTemplate = await threadStore.rename(input.profileId, sessionThread.thread.id, templateTitle);
            if (renamedTemplate.isErr()) {
                return;
            }

            const mode = modeRaw === TITLE_AI_MODE || modeRaw === 'ai_optional' ? TITLE_AI_MODE : DEFAULT_TITLE_MODE;
            if (mode !== TITLE_AI_MODE) {
                return;
            }
            const namingUsesUtilityModel = await utilityModelConsumerPreferencesService.shouldUseUtilityModel(
                input.profileId,
                'conversation_naming'
            );
            const titleTarget = namingUsesUtilityModel
                ? await utilityModelService.resolveUtilityModelTarget({
                      profileId: input.profileId,
                      fallbackProviderId: input.providerId,
                      fallbackModelId: input.modelId,
                  })
                : {
                      providerId: input.providerId,
                      modelId: input.modelId,
                      source: 'fallback' as const,
                  };
            const aiTitle = await generateAiTitle({
                profileId: input.profileId,
                providerId: titleTarget.providerId,
                modelId: titleTarget.modelId,
                prompt: input.prompt,
                templateTitle,
            });
            if (!aiTitle) {
                return;
            }
            const renamedAi = await threadStore.rename(input.profileId, sessionThread.thread.id, aiTitle);
            if (renamedAi.isErr()) {
                return;
            }
        } catch (error) {
            appLog.warn({
                tag: 'thread-title',
                message: 'Failed to apply automatic thread title.',
                profileId: input.profileId,
                sessionId: input.sessionId,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
}

export const threadTitleService = new ThreadTitleService();
