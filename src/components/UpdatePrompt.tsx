import { useRegisterSW } from "virtual:pwa-register/react";
import { useEffect } from "react";

const CACHE_VERSION_KEY = "app_cache_version";
const CURRENT_VERSION = "2026-11-04-v4";

const clearAllCaches = async () => {
  // Clear CacheStorage
  if ("caches" in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));
  }
  // Clear cookies
  document.cookie.split(";").forEach((c) => {
    document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
  });
  // Unregister old service workers
  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((r) => r.unregister()));
  }
};

const UpdatePrompt = () => {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
        setInterval(() => {
          registration.update();
        }, 30 * 1000);
      }
    },
    onRegisterError(error) {
      console.error("SW registration error", error);
    },
  });

  // Force clear caches on version change
  useEffect(() => {
    const storedVersion = localStorage.getItem(CACHE_VERSION_KEY);
    if (storedVersion !== CURRENT_VERSION) {
      clearAllCaches().then(() => {
        localStorage.setItem(CACHE_VERSION_KEY, CURRENT_VERSION);
        window.location.reload();
      });
    }
  }, []);

  useEffect(() => {
    if (needRefresh) {
      (async () => {
        await clearAllCaches();
        await updateServiceWorker(true);
      })();
    }
  }, [needRefresh, updateServiceWorker]);

  return null;
};

export default UpdatePrompt;
