import { createRootRouteWithContext } from '@tanstack/react-router';

import RootLayout from '@/web/layouts/index';
import type { AppRouterContext } from '@/web/routerContext';

export const Route = createRootRouteWithContext<AppRouterContext>()({ component: RootLayout });
