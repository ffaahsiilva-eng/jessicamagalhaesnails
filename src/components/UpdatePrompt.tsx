import { useRegisterSW } from "virtual:pwa-register/react";
import { useState, useEffect } from "react";
import { RefreshCw, X } from "lucide-react";

const UpdatePrompt = () => {
  const [showUpdate, setShowUpdate] = useState(false);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      // Check for updates every 60 seconds
      if (registration) {
        setInterval(() => {
          registration.update();
        }, 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error("SW registration error", error);
    },
  });

  useEffect(() => {
    if (needRefresh) {
      setShowUpdate(true);
    }
  }, [needRefresh]);

  const handleUpdate = async () => {
    // Clear all caches
    if ("caches" in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
    }
    // Clear cookies
    document.cookie.split(";").forEach((c) => {
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });
    // Activate new service worker and reload
    await updateServiceWorker(true);
  };

  if (!showUpdate) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-primary text-primary-foreground shadow-lg animate-in slide-in-from-top duration-300">
      <div className="container mx-auto flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <div>
            <p className="font-semibold text-sm">Nova Atualização Disponível! 🎉</p>
            <p className="text-xs opacity-90">Clique para atualizar e ver as novidades.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleUpdate}
            className="rounded-full bg-white/20 px-4 py-1.5 text-sm font-medium backdrop-blur-sm hover:bg-white/30 transition-colors"
          >
            Atualizar
          </button>
          <button
            onClick={() => setShowUpdate(false)}
            className="rounded-full p-1.5 hover:bg-white/20 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdatePrompt;
