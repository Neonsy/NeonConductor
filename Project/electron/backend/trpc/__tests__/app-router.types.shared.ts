import type { AppRouter } from '@/app/backend/trpc/router';

import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';

const OPENAI_PROCEDURE_PREFIX = 'getOpenAI';

export const OPENAI_USAGE_PROCEDURE = `${OPENAI_PROCEDURE_PREFIX}SubscriptionUsage` as const;
export const OPENAI_RATE_LIMITS_PROCEDURE = `${OPENAI_PROCEDURE_PREFIX}SubscriptionRateLimits` as const;

export type AppRouterInputs = inferRouterInputs<AppRouter>;
export type AppRouterOutputs = inferRouterOutputs<AppRouter>;
