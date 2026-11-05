import { useRegisterSW } from "virtual:pwa-register/react";
import { useEffect } from "react";

const UpdatePrompt = () => {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
        setInterval(() => {
          try {
            registration.update();
          } catch {
            // Ignore SW update errors
          }
        }, 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.warn("SW registration error (ignored)", error);
    },
  });

  useEffect(() => {
    if (needRefresh) {
      // Auto-update to new service worker smoothly
      try {
        updateServiceWorker(true);
      } catch (err) {
        console.warn("Failed to auto-update SW:", err);
      }
    }
  }, [needRefresh, updateServiceWorker]);

  return null;
};

export default UpdatePrompt;
