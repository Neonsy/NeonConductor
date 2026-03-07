import { EyeOff, Shield } from 'lucide-react';

import { Button } from '@/web/components/ui/button';
import { usePrivacyMode } from '@/web/lib/privacy/privacyContext';
import { cn } from '@/web/lib/utils';

import type { ReactNode } from 'react';

export default function PrivacyModeToggle(): ReactNode {
    const { enabled, toggleEnabled } = usePrivacyMode();

    return (
        <Button
            type='button'
            size='sm'
            variant={enabled ? 'secondary' : 'ghost'}
            data-no-drag='true'
            aria-label={enabled ? 'Disable privacy mode' : 'Enable privacy mode'}
            aria-pressed={enabled}
            title={enabled ? 'Privacy mode on' : 'Privacy mode off'}
            className={cn(
                'h-8 min-w-11 rounded-md px-2.5 text-[11px] font-semibold tracking-[0.08em] uppercase [-webkit-app-region:no-drag]',
                enabled ? 'shadow-sm' : ''
            )}
            onClick={toggleEnabled}>
            {enabled ? <EyeOff className='h-3.5 w-3.5' /> : <Shield className='h-3.5 w-3.5' />}
            {enabled ? 'Private' : 'Privacy'}
        </Button>
    );
}
