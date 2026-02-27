import { useRegisterSW } from "virtual:pwa-register/react";
import { useEffect } from "react";

const UpdatePrompt = () => {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
        // Check for updates every 30 seconds
        setInterval(() => {
          registration.update();
        }, 30 * 1000);
      }
    },
    onRegisterError(error) {
      console.error("SW registration error", error);
    },
  });

  useEffect(() => {
    if (needRefresh) {
      // Auto-update: clear caches and reload immediately
      (async () => {
        if ("caches" in window) {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map((name) => caches.delete(name)));
        }
        document.cookie.split(";").forEach((c) => {
          document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
        });
        await updateServiceWorker(true);
      })();
    }
  }, [needRefresh, updateServiceWorker]);

  // No UI needed — updates happen automatically
  return null;
};

export default UpdatePrompt;
