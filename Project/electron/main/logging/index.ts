import { initLogger, log } from 'evlog';

import { flushLogDrain, getLogDrain } from '@/app/main/logging/fileDrain';

export interface InitAppLoggerOptions {
    isDev: boolean;
    version: string;
}

let appLoggerEnabled = false;

function resolveEnvironment(isDev: boolean): string {
    return process.env['NODE_ENV'] ?? (isDev ? 'development' : 'production');
}

function resolveEnabled(isDev: boolean): boolean {
    const enabledOverride = process.env['EVLOG_ENABLED'];

    if (enabledOverride === '1') {
        return true;
    }

    if (enabledOverride === '0') {
        return false;
    }

    return isDev;
}

function resolvePretty(isDev: boolean): boolean {
    const prettyOverride = process.env['EVLOG_PRETTY'];

    if (prettyOverride === '1') {
        return true;
    }

    if (prettyOverride === '0') {
        return false;
    }

    return isDev;
}

export const appLog = log;

export function isAppLoggerEnabled(): boolean {
    return appLoggerEnabled;
}

export function initAppLogger(options: InitAppLoggerOptions): void {
    const { isDev, version } = options;
    appLoggerEnabled = resolveEnabled(isDev);

    if (!appLoggerEnabled) {
        return;
    }

    const pretty = resolvePretty(isDev);

    initLogger({
        env: {
            service: 'neon-conductor-main',
            environment: resolveEnvironment(isDev),
            version,
        },
        pretty,
        stringify: true,
        drain: getLogDrain(),
    });

    appLog.info('logging', `evlog initialized (pretty=${pretty ? 'on' : 'off'})`);
}

export async function flushAppLogger(): Promise<void> {
    if (!appLoggerEnabled) {
        return;
    }

    try {
        await flushLogDrain();
    } catch (error) {
        console.error('[logging] Failed to flush evlog drain before exit:', error);
    }
}
