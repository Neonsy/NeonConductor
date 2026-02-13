import { aiDevtoolsPlugin } from '@tanstack/react-ai-devtools';
import { TanStackDevtools } from '@tanstack/react-devtools';
import { formDevtoolsPlugin } from '@tanstack/react-form-devtools';
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';

import type { AnyRouter } from '@tanstack/react-router';

export interface DevToolsProps {
    router: AnyRouter;
}

export default function DevTools({ router }: DevToolsProps) {
    return (
        <TanStackDevtools
            plugins={[
                {
                    name: 'TanStack Router',
                    render: <TanStackRouterDevtoolsPanel router={router} />,
                },
                {
                    name: 'TanStack Query',
                    render: <ReactQueryDevtoolsPanel />,
                },
                aiDevtoolsPlugin(),
                formDevtoolsPlugin(),
            ]}
            eventBusConfig={{
                connectToServerBus: true,
            }}
        />
    );
}
