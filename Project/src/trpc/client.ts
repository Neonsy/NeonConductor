import { createTRPCReact } from '@trpc/react-query';

import type { AppRouter } from '@/app/backend/trpc/router';

export const trpc = createTRPCReact<AppRouter>();
