import { registerSW } from 'virtual:pwa-register';

let deferredPrompt: BeforeInstallPromptEvent | null = null;

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

function dispatchPWAEvent(type: string, detail?: unknown): void {
  window.dispatchEvent(new CustomEvent(`pwa:${type}`, { detail }));
}

// Capture install prompt
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e as BeforeInstallPromptEvent;
  console.log('[PWA] Install prompt captured');
  dispatchPWAEvent('installable');
});

window.addEventListener('appinstalled', () => {
  console.log('[PWA] App installed');
  deferredPrompt = null;
  dispatchPWAEvent('installed');
});

window.addEventListener('online', () => {
  console.log('[PWA] Online');
  dispatchPWAEvent('online');
});

window.addEventListener('offline', () => {
  console.log('[PWA] Offline');
  dispatchPWAEvent('offline');
});

// Expose install prompt helper
(window as any).promptToInstall = async (): Promise<{ outcome: string } | null> => {
  if (!deferredPrompt) {
    console.log('[PWA] No install prompt available');
    return null;
  }

  try {
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log('[PWA] Install prompt outcome:', outcome);
    deferredPrompt = null;
    return { outcome };
  } catch (error) {
    console.error('[PWA] Install prompt failed:', error);
    return null;
  }
};

// Register service worker using vite-pwa
const updateSW = registerSW({
  immediate: true,
  onRegisteredSW(swScriptUrl) {
    console.log('[PWA] Service worker registered:', swScriptUrl);
  },
  onOfflineReady() {
    console.log('[PWA] App ready to work offline');
    dispatchPWAEvent('offlineready');
  },
  onNeedRefresh() {
    console.log('[PWA] New version available');
    dispatchPWAEvent('updateavailable');
  },
});

// Expose update function for UI
(window as any).updateServiceWorker = () => {
  updateSW(true);
};
