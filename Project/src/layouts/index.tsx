import { Outlet } from '@tanstack/react-router';

export default function RootLayout() {
    return (
        <div>
            <Outlet />
        </div>
    );
}
