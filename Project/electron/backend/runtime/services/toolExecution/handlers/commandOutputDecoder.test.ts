import iconv from 'iconv-lite';
import { describe, expect, it } from 'vitest';

import { decodeCommandOutput } from '@/app/backend/runtime/services/toolExecution/handlers/commandOutputDecoder';

describe('commandOutputDecoder', () => {
    it('keeps valid utf8 output unchanged', () => {
        const buffer = Buffer.from('hello world', 'utf8');

        expect(decodeCommandOutput(buffer, 'win32')).toBe('hello world');
    });

    it('decodes Windows-1252 punctuation cases', () => {
        const buffer = iconv.encode('“quoted” test — value', 'windows-1252');

        expect(decodeCommandOutput(buffer, 'win32')).toBe('“quoted” test — value');
    });

    it('decodes CP1251 text', () => {
        const buffer = iconv.encode('Привет из PowerShell', 'cp1251');

        expect(decodeCommandOutput(buffer, 'win32')).toBe('Привет из PowerShell');
    });

    it('decodes CP866 text', () => {
        const buffer = iconv.encode('Привет из cmd', 'cp866');

        expect(decodeCommandOutput(buffer, 'win32')).toBe('Привет из cmd');
    });
});
