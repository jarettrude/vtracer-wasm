import { initPWA, skipWaiting } from '../lib/pwa';

// Initialize PWA functionality
initPWA();

// Handle PWA install banner
const installBanner = document.getElementById('pwa-install-banner');
const installBtn = document.getElementById('pwa-install-btn');
const installClose = document.getElementById('pwa-install-close');
const installLater = document.getElementById('pwa-install-later');

window.addEventListener('pwa:installable', () => {
  installBanner?.classList.remove('hidden');
});

installBtn?.addEventListener('click', async () => {
  const result = await (window as any).promptToInstall?.();
  if (result?.outcome === 'accepted') {
    installBanner?.classList.add('hidden');
  }
});

installClose?.addEventListener('click', () => {
  installBanner?.classList.add('hidden');
});

installLater?.addEventListener('click', () => {
  installBanner?.classList.add('hidden');
});

// Handle offline indicator
const offlineIndicator = document.getElementById('offline-indicator');
const offlineClose = document.getElementById('offline-close');
const offlineMinimize = document.getElementById('offline-minimize');
const offlinePill = document.getElementById('offline-pill');
const offlinePillExpand = document.getElementById('offline-pill-expand');

let minimizedTimer: number | null = null;
let dismissedUntilReconnect = false;

const showIndicator = () => {
  if (dismissedUntilReconnect) return;
  offlineIndicator?.classList.remove('hidden');
  offlinePill?.classList.add('hidden');
  clearMinimizeTimer();
  scheduleMinimize();
};

const hideIndicator = () => {
  offlineIndicator?.classList.add('hidden');
  clearMinimizeTimer();
};

const showPill = () => {
  offlineIndicator?.classList.add('hidden');
  offlinePill?.classList.remove('hidden');
};

const hidePill = () => {
  offlinePill?.classList.add('hidden');
};

const clearMinimizeTimer = () => {
  if (minimizedTimer !== null) {
    window.clearTimeout(minimizedTimer);
    minimizedTimer = null;
  }
};

const scheduleMinimize = () => {
  clearMinimizeTimer();
  minimizedTimer = window.setTimeout(() => {
    showPill();
  }, 8000);
};

window.addEventListener('online', () => {
  dismissedUntilReconnect = false;
  hideIndicator();
  hidePill();
});

window.addEventListener('offline', () => {
  showIndicator();
});

window.addEventListener('pwa:offline', () => {
  showIndicator();
});

window.addEventListener('pwa:online', () => {
  dismissedUntilReconnect = false;
  hideIndicator();
  hidePill();
});

if (!navigator.onLine) {
  showIndicator();
}

offlineClose?.addEventListener('click', () => {
  dismissedUntilReconnect = true;
  hideIndicator();
  hidePill();
});

offlineMinimize?.addEventListener('click', () => {
  dismissedUntilReconnect = false;
  showPill();
});

offlinePillExpand?.addEventListener('click', () => {
  dismissedUntilReconnect = false;
  hidePill();
  showIndicator();
});

// Expose manual controls for debugging or other UI hooks
(globalThis as any).offlineBanner = {
  show: () => {
    dismissedUntilReconnect = false;
    showIndicator();
  },
  hide: () => {
    dismissedUntilReconnect = true;
    hideIndicator();
    hidePill();
  },
  reset: () => {
    dismissedUntilReconnect = false;
    hidePill();
    showIndicator();
  },
  pill: {
    show: () => showPill(),
    hide: () => hidePill(),
  },
};

const updateBanner = document.getElementById('update-banner');
const updateBtn = document.getElementById('update-btn');

window.addEventListener('pwa:updateavailable', () => {
  updateBanner?.classList.remove('hidden');
});

updateBtn?.addEventListener('click', () => {
  skipWaiting();
  window.location.reload();
});
