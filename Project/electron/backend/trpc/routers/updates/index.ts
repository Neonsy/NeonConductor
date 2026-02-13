import { type as arktype } from 'arktype';
import { Menu, screen } from 'electron';

import { publicProcedure, router } from '@/app/backend/trpc/init';
import {
    checkForUpdatesManually,
    getCurrentChannel,
    getSwitchStatusSnapshot,
    switchChannel,
} from '@/app/main/updates/updater';

import type { BrowserWindow, MenuItemConstructorOptions } from 'electron';

const updateChannelSchema = arktype("'stable' | 'beta' | 'alpha'");
const CHANNELS = ['stable', 'beta', 'alpha'] as const;

function toChannelLabel(channel: (typeof CHANNELS)[number]): string {
    if (channel === 'stable') return 'Stable';
    if (channel === 'beta') return 'Beta';
    return 'Alpha';
}

function showUpdatesMenu(win: BrowserWindow | null): { success: boolean } {
    if (!win) return { success: false };

    const currentChannel = getCurrentChannel();

    const template: MenuItemConstructorOptions[] = [
        {
            label: 'Check for Updates',
            click: () => {
                void checkForUpdatesManually();
            },
        },
        { type: 'separator' },
        {
            label: 'Update Channel',
            submenu: CHANNELS.map((channel) => {
                if (channel === currentChannel) {
                    return {
                        label: toChannelLabel(channel),
                        enabled: false,
                    };
                }

                return {
                    label: toChannelLabel(channel),
                    click: () => {
                        void switchChannel(channel);
                    },
                };
            }),
        },
    ];

    const menu = Menu.buildFromTemplate(template);
    const cursor = screen.getCursorScreenPoint();
    const bounds = win.getBounds();
    const x = Math.max(0, cursor.x - bounds.x);
    const y = Math.max(0, cursor.y - bounds.y);

    menu.popup({ window: win, x, y });
    return { success: true };
}

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
    showMenu: publicProcedure.mutation(({ ctx }) => {
        return showUpdatesMenu(ctx.win);
    }),
});
