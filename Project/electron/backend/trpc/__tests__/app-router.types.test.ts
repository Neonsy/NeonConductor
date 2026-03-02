import { expectTypeOf, test } from 'vitest';
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';

import type { AppRouter } from '@/app/backend/trpc/router';

test('AppRouter exposes runtime procedure contracts to clients', () => {
    type Inputs = inferRouterInputs<AppRouter>;
    type Outputs = inferRouterOutputs<AppRouter>;

    expectTypeOf<Inputs['session']['create']>().toMatchTypeOf<{
        scope: 'detached' | 'workspace';
        kind: 'local' | 'worktree' | 'cloud';
    }>();

    expectTypeOf<Inputs['session']['prompt']>().toMatchTypeOf<{
        sessionId: string;
        prompt: string;
    }>();

    expectTypeOf<Inputs['provider']['setDefault']>().toMatchTypeOf<{
        providerId: string;
        modelId: string;
    }>();

    expectTypeOf<Inputs['permission']['request']>().toMatchTypeOf<{
        policy: 'ask' | 'allow' | 'deny';
        resource: string;
    }>();

    expectTypeOf<Outputs['mcp']['listServers']>().toMatchTypeOf<{
        servers: Array<{
            id: string;
            label: string;
            authMode: 'none' | 'token';
            connectionState: 'disconnected' | 'connected';
            authState: 'unauthenticated' | 'authenticated';
        }>;
    }>();
});

