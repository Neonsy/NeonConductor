import { useState } from 'react';

import { createFailClosedAsyncAction } from '@/web/lib/async/createFailClosedAsyncAction';
import { invalidateRuntimeResetQueries } from '@/web/lib/runtime/invalidation/queryInvalidation';
import { trpc } from '@/web/trpc/client';

import { FACTORY_RESET_CONFIRMATION_TEXT } from '@/shared/contracts';

interface ProfileResetControllerInput {
    setSelectedProfileId: (profileId: string | undefined) => void;
    setStatusMessage: (value: string | undefined) => void;
    onProfileActivated: (profileId: string) => void;
}

export function useProfileResetController(input: ProfileResetControllerInput) {
    const utils = trpc.useUtils();
    const [confirmFactoryResetOpen, setConfirmFactoryResetOpen] = useState(false);
    const [factoryResetConfirmationText, setFactoryResetConfirmationText] = useState('');

    const factoryResetMutation = trpc.runtime.factoryReset.useMutation({
        onSuccess: async (result) => {
            setConfirmFactoryResetOpen(false);
            setFactoryResetConfirmationText('');
            input.setSelectedProfileId(result.resetProfileId);
            input.onProfileActivated(result.resetProfileId);
            await invalidateRuntimeResetQueries(utils);
            input.setStatusMessage('Factory reset completed. App data was reset to the default profile.');
        },
    });

    return {
        confirmFactoryResetOpen,
        factoryResetConfirmationText,
        factoryResetConfirmationPhrase: FACTORY_RESET_CONFIRMATION_TEXT,
        factoryResetMutation,
        setConfirmFactoryResetOpen,
        setFactoryResetConfirmationText,
        factoryResetAppData: createFailClosedAsyncAction(async () => {
            await factoryResetMutation.mutateAsync({
                confirm: true,
                confirmationText: factoryResetConfirmationText,
            });
        }),
    };
}
