import { describe, expect, it } from 'vitest';

import { resolveTabSwitchNotice } from '@/web/components/conversation/shell/workspace/tabSwitch';

describe('resolveTabSwitchNotice', () => {
    it('does not emit a notice when the shell stays on the same top-level tab', () => {
        expect(resolveTabSwitchNotice('chat', 'chat')).toEqual({
            shouldSwitch: false,
        });
    });

    it('emits a user-visible notice when the shell switches tabs to open a thread', () => {
        expect(resolveTabSwitchNotice('chat', 'agent')).toEqual({
            shouldSwitch: true,
            notice: 'Switched to agent to open this thread.',
        });
    });
});
