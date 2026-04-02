import type { ModeDefinition } from '@/shared/contracts';
import type { KiloModeHeader } from '@/shared/kiloModels';
import { resolveModeRoutingIntent } from '@/shared/modeRouting';

export function resolveKiloModeHeader(mode: ModeDefinition): KiloModeHeader | undefined {
    return resolveModeRoutingIntent(mode).kiloModeHeader;
}

