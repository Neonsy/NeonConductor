import { useEffect } from 'react';

import { ensureInitialRendererBootStatusReport } from '@/web/components/runtime/initialRendererBootStatus';

export function RendererBootStatusBootstrap() {
    useEffect(() => {
        void ensureInitialRendererBootStatusReport();
    }, []);

    return null;
}
