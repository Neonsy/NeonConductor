/*
Why: Root file-based route mapping to the Home page.
*/

import { createFileRoute } from '@tanstack/react-router';

import { prefetchWorkspaceBootData } from '@/web/components/runtime/workspaceBootLoader';
import Home from '@/web/pages/index';

export const Route = createFileRoute('/')({
    loader: ({ context }) =>
        prefetchWorkspaceBootData({
            trpcUtils: context.trpcUtils,
        }),
    component: Home,
});
