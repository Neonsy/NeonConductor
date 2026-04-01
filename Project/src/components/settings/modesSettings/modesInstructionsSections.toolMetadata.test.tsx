import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { BuiltInToolMetadataCard } from '@/web/components/settings/modesSettings/modesInstructionsSections';

describe('built-in tool metadata card', () => {
    it('renders editable tool metadata details', () => {
        const html = renderToStaticMarkup(
            createElement(BuiltInToolMetadataCard, {
                toolId: 'write_file',
                label: 'Write File',
                description: 'Create or replace a full file.',
                defaultDescription: 'Create or replace a full file.',
                isModified: true,
                isSaving: false,
                onChange: vi.fn(),
                onSave: vi.fn(),
                onReset: vi.fn(),
            })
        );

        expect(html).toContain('Write File');
        expect(html).toContain('Tool ID:');
        expect(html).toContain('write_file');
        expect(html).toContain('Shipped Default');
        expect(html).toContain('Modified');
        expect(html).toContain('Save');
        expect(html).toContain('Reset');
    });
});
