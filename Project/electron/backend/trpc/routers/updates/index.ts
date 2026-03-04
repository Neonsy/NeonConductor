import { type as arktype } from 'arktype';

import { publicProcedure, router } from '@/app/backend/trpc/init';
import {
    checkForUpdatesManually,
    getCurrentChannel,
    getSwitchStatusSnapshot,
    switchChannel,
} from '@/app/main/updates/updater';

const updateChannelSchema = arktype("'stable' | 'beta' | 'alpha'");

export const updatesRouter = router({
    getChannel: publicProcedure.query(() => {
        return { channel: getCurrentChannel() };
    }),
    setChannel: publicProcedure.input(updateChannelSchema).mutation(async ({ input }) => {
        return switchChannel(input);
    }),
    getSwitchStatus: publicProcedure.query(() => {
        return getSwitchStatusSnapshot();
    }),
    checkForUpdates: publicProcedure.mutation(() => {
        return checkForUpdatesManually();
    }),
});
