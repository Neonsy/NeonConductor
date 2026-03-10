import mascotUrl from '@/web/assets/appicon.png';
import { applyBootStatus, normalizeBootStatusSnapshot } from '@/web/splash/model';

import { INITIAL_BOOT_STATUS_SNAPSHOT, type BootStatusSnapshot } from '@/app/shared/splashContract';

import './styles.css';

function initializeSplash(): void {
    const mascotImage = document.querySelector<HTMLImageElement>('[data-splash-mascot]');
    if (mascotImage) {
        mascotImage.src = mascotUrl;
    }

    applyBootStatus(document, normalizeBootStatusSnapshot(INITIAL_BOOT_STATUS_SNAPSHOT));

    const removeStatusListener = window.neonSplash?.onStatusChange((status: BootStatusSnapshot) => {
        applyBootStatus(document, status);
    });

    window.addEventListener(
        'beforeunload',
        () => {
            removeStatusListener?.();
        },
        { once: true }
    );
}

initializeSplash();
