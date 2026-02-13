import { Outlet } from '@tanstack/react-router';

import TitleBar from '@/web/components/window/titleBar';
import UpdateSwitchModal from '@/web/components/window/updateSwitchModal';

export default function RootLayout() {
    return (
        <div className='flex min-h-screen flex-col'>
            <TitleBar />
            <div className='flex min-h-0 flex-1'>
                <Outlet />
            </div>
            <UpdateSwitchModal />
        </div>
    );
}
