import { LaptopMinimal, Moon, Sun } from 'lucide-react';

import { Button } from '@/web/components/ui/button';
import type { ThemePreference } from '@/web/lib/theme/theme';
import { useTheme } from '@/web/lib/theme/themeContext';
import { cn } from '@/web/lib/utils';

import type { ReactNode } from 'react';

interface ThemeButtonProps {
    preference: ThemePreference;
    active: boolean;
    icon: ReactNode;
    label: string;
    onSelect: (preference: ThemePreference) => void;
}

function ThemeButton({ preference, active, icon, label, onSelect }: ThemeButtonProps): ReactNode {
    return (
        <Button
            type='button'
            size='icon'
            variant={active ? 'secondary' : 'ghost'}
            aria-label={`Set theme to ${label.toLowerCase()}`}
            aria-pressed={active}
            title={label}
            className={cn('h-7 w-7 rounded-md', active ? 'shadow-sm' : '')}
            onClick={() => {
                onSelect(preference);
            }}>
            {icon}
        </Button>
    );
}

export default function ThemeToggle(): ReactNode {
    const { preference, setPreference } = useTheme();

    return (
        <div
            data-no-drag='true'
            className='border-border bg-background/70 inline-flex h-8 items-center gap-0.5 rounded-md border px-1 [-webkit-app-region:no-drag]'>
            <ThemeButton
                preference='auto'
                active={preference === 'auto'}
                icon={<LaptopMinimal className='h-3.5 w-3.5' />}
                label='Auto'
                onSelect={setPreference}
            />
            <ThemeButton
                preference='light'
                active={preference === 'light'}
                icon={<Sun className='h-3.5 w-3.5' />}
                label='Light'
                onSelect={setPreference}
            />
            <ThemeButton
                preference='dark'
                active={preference === 'dark'}
                icon={<Moon className='h-3.5 w-3.5' />}
                label='Dark'
                onSelect={setPreference}
            />
        </div>
    );
}
