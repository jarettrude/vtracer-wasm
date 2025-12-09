/**
 * PWA utilities for VTracer WASM
 * 
 * Provides Progressive Web App functionality including:
 * - Service worker registration and update management
 * - Install prompt handling and app installation detection
 * - Online/offline status monitoring
 * - Custom event dispatching for PWA state changes
 */

export interface PWAStatus {
  isInstalled: boolean;
  isOnline: boolean;
  isUpdateAvailable: boolean;
  registration: ServiceWorkerRegistration | null;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let swRegistration: ServiceWorkerRegistration | null = null;

/**
 * Custom event for beforeinstallprompt
 * Extends standard Event with install-specific properties
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

/**
 * Register the service worker for offline functionality
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.log('[PWA] Service workers not supported');
    return null;
  }

  try {
    const baseUrl = (import.meta as any).env?.BASE_URL ?? '/';
    const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    const swPath = `${normalizedBase}sw.js`;

    swRegistration = await navigator.serviceWorker.register(swPath, {
      scope: normalizedBase,
    });

    console.log('[PWA] Service worker registered:', swRegistration.scope);

    setInterval(() => {
      swRegistration?.update();
    }, 60 * 60 * 1000);

    swRegistration.addEventListener('updatefound', () => {
      const newWorker = swRegistration?.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[PWA] New version available');
            dispatchPWAEvent('updateavailable');
          }
        });
      }
    });

    return swRegistration;
  } catch (error) {
    console.error('[PWA] Service worker registration failed:', error);
    return null;
  }
}

/**
 * Check if the app is running in standalone mode (installed PWA)
 */
export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://')
  );
}

/**
 * Check if the app can be installed
 */
export function canInstall(): boolean {
  return deferredPrompt !== null;
}

/**
 * Prompt the user to install the PWA
 */
export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) {
    console.log('[PWA] No install prompt available');
    return false;
  }

  try {
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    console.log('[PWA] Install prompt outcome:', outcome);
    deferredPrompt = null;
    
    return outcome === 'accepted';
  } catch (error) {
    console.error('[PWA] Install prompt failed:', error);
    return false;
  }
}

/**
 * Skip waiting and activate new service worker
 */
export function skipWaiting(): void {
  if (swRegistration?.waiting) {
    swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }
}

/**
 * Get the current PWA status
 */
export function getPWAStatus(): PWAStatus {
  return {
    isInstalled: isStandalone(),
    isOnline: navigator.onLine,
    isUpdateAvailable: swRegistration?.waiting !== null,
    registration: swRegistration,
  };
}

/**
 * Dispatch a custom PWA event to the main window
 * @param type - Event type suffix (e.g., 'installable', 'online')
 * @param detail - Optional event data payload
 */
function dispatchPWAEvent(type: string, detail?: any): void {
  window.dispatchEvent(new CustomEvent(`pwa:${type}`, { detail }));
}

/**
 * Initialize PWA functionality
 */
export function initPWA(): void {
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

  registerServiceWorker();

  // Expose helpers for UI scripts
  (window as any).promptToInstall = promptInstall;
}
