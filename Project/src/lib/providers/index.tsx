import { TRPCProvider } from '@/web/lib/providers/trpc';

import type { ReactNode } from 'react';

interface ProvidersProps {
    children: ReactNode;
}

export default function Providers({ children }: ProvidersProps): ReactNode {
    return <TRPCProvider>{children}</TRPCProvider>;
}
