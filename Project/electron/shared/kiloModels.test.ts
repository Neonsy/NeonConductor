import { describe, expect, it } from 'vitest';

import {
    canonicalizeKiloModelId,
    isKiloAutoModelId,
    kiloFrontierModelId,
    kiloFreeModelId,
    kiloSmallModelId,
} from '@/shared/kiloModels';

describe('kilo model ids', () => {
    it('canonicalizes legacy Kilo ids to current canonical ids', () => {
        expect(canonicalizeKiloModelId('kilo/auto')).toBe(kiloFrontierModelId);
        expect(canonicalizeKiloModelId('kilo/auto-free')).toBe(kiloFreeModelId);
        expect(canonicalizeKiloModelId('kilo/code')).toBe(kiloSmallModelId);
    });

    it('recognizes canonical auto models after canonicalizing legacy ids', () => {
        expect(isKiloAutoModelId('kilo/auto')).toBe(true);
        expect(isKiloAutoModelId(kiloFrontierModelId)).toBe(true);
        expect(isKiloAutoModelId('minimax/minimax-m2.5:free')).toBe(false);
    });
});
