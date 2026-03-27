import { MemoryPanelSections } from '@/web/components/conversation/panels/memoryPanelSections';
import { useMemoryPanelController } from '@/web/components/conversation/panels/memoryPanelController';

import type { MemoryPanelProps } from '@/web/components/conversation/panels/memoryPanel.types';

export type { MemoryPanelProps } from '@/web/components/conversation/panels/memoryPanel.types';

export { runProjectionRescan } from '@/web/components/conversation/panels/memoryPanelController';

export function MemoryPanel(input: MemoryPanelProps) {
    const controller = useMemoryPanelController(input);

    return <MemoryPanelSections controller={controller} />;
}
