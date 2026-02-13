import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const devServerUrl = process.env['VITE_DEV_SERVER_URL'];
export const isDev = Boolean(devServerUrl);

export function getMainDirname(importMetaUrl: string): string {
    const filename = fileURLToPath(importMetaUrl);
    return path.dirname(filename);
}
