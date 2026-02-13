/*
Why: Root file-based route mapping to the Home page.
*/

import { createFileRoute } from '@tanstack/react-router';

import Home from '@/web/pages/index';

export const Route = createFileRoute('/')({ component: Home });
