import { useState } from 'react';

import type {
    BuiltInToolMetadataDraftState,
    BuiltInToolMetadataSnapshot,
} from '@/web/components/settings/modesSettings/modesInstructionsControllerShared';
import { createFailClosedAsyncAction } from '@/web/lib/async/createFailClosedAsyncAction';
import { PROGRESSIVE_QUERY_OPTIONS } from '@/web/lib/query/progressiveQueryOptions';
import { trpc } from '@/web/trpc/client';

export function useModesInstructionsToolMetadataController(input: {
    clearFeedback: () => void;
    setErrorFeedback: (message: string) => void;
    setSuccessFeedback: (message: string) => void;
}) {
    const utils = trpc.useUtils();
    const [toolMetadataDrafts, setToolMetadataDrafts] = useState<BuiltInToolMetadataDraftState>({});
    const wrapFailClosedAction = <TArgs extends unknown[]>(action: (...args: TArgs) => Promise<void>) =>
        createFailClosedAsyncAction(action);

    const metadataQuery = trpc.tool.listBuiltInMetadata.useQuery(undefined, PROGRESSIVE_QUERY_OPTIONS);

    function applyToolMetadata(tools: BuiltInToolMetadataSnapshot): void {
        utils.tool.listBuiltInMetadata.setData(undefined, { tools });
        void utils.tool.list.invalidate();
    }

    function resolveDescription(toolId: string, persistedDescription: string): string {
        const draft = toolMetadataDrafts[toolId];
        return draft?.description ?? persistedDescription;
    }

    const setBuiltInDescriptionMutation = trpc.tool.setBuiltInDescription.useMutation({
        onSuccess: ({ tools }, variables) => {
            applyToolMetadata(tools);
            setToolMetadataDrafts((currentDrafts) => ({
                ...currentDrafts,
                [variables.toolId]: undefined,
            }));
            input.setSuccessFeedback(`Saved built-in tool description for ${variables.toolId}.`);
        },
        onError: (error) => {
            input.setErrorFeedback(error.message);
        },
    });

    const resetBuiltInDescriptionMutation = trpc.tool.resetBuiltInDescription.useMutation({
        onSuccess: ({ tools }, variables) => {
            applyToolMetadata(tools);
            setToolMetadataDrafts((currentDrafts) => ({
                ...currentDrafts,
                [variables.toolId]: undefined,
            }));
            input.setSuccessFeedback(`Reset built-in tool description for ${variables.toolId}.`);
        },
        onError: (error) => {
            input.setErrorFeedback(error.message);
        },
    });

    return {
        toolMetadataQuery: metadataQuery,
        builtInToolMetadata: {
            isSaving: setBuiltInDescriptionMutation.isPending || resetBuiltInDescriptionMutation.isPending,
            items: (metadataQuery.data?.tools ?? []).map((tool) => ({
                ...tool,
                description: resolveDescription(tool.toolId, tool.description),
            })),
            setDescription: (toolId: string, description: string) => {
                setToolMetadataDrafts((currentDrafts) => ({
                    ...currentDrafts,
                    [toolId]: {
                        description,
                    },
                }));
                input.clearFeedback();
            },
            save: wrapFailClosedAction(async (toolId: string) => {
                const persistedTool = metadataQuery.data?.tools.find((tool) => tool.toolId === toolId);
                if (!persistedTool) {
                    throw new Error(`Built-in tool metadata for "${toolId}" is not available.`);
                }

                await setBuiltInDescriptionMutation.mutateAsync({
                    toolId,
                    description: resolveDescription(toolId, persistedTool.description),
                });
            }),
            reset: wrapFailClosedAction(async (toolId: string) => {
                await resetBuiltInDescriptionMutation.mutateAsync({
                    toolId,
                });
            }),
        },
    };
}
