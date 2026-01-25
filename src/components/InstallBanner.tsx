import { useState, useEffect } from "react";
 import { motion } from "framer-motion";
import { X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const InstallBanner = () => {
  const [showBanner, setShowBanner] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Check if already installed
    const isInstalled = window.matchMedia("(display-mode: standalone)").matches;
    
    // Check if user dismissed the banner
    const dismissed = localStorage.getItem("install-banner-dismissed");
    
    // Check if install prompt is available
    const hasPrompt = "BeforeInstallPromptEvent" in window;

    // Show banner if not installed, not dismissed, and can be installed
    if (!isInstalled && !dismissed && (hasPrompt || /iPad|iPhone|iPod/.test(navigator.userAgent))) {
      // Delay showing banner for better UX
      setTimeout(() => setShowBanner(true), 3000);
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    setShowBanner(false);
    localStorage.setItem("install-banner-dismissed", "true");
  };

  if (isDismissed) return null;

  return (
    <>
      {showBanner && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-40"
        >
          <div className="bg-card border border-border rounded-2xl shadow-card p-4">
            <button
              onClick={handleDismiss}
              className="absolute top-2 right-2 p-1 hover:bg-secondary rounded-full transition-colors"
              aria-label="Fechar banner"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>

            <div className="flex items-start gap-3 pr-6">
              <div className="bg-primary/10 rounded-xl p-2 flex-shrink-0">
                <Download className="h-5 w-5 text-primary" />
              </div>
              
              <div className="flex-1">
                <h3 className="font-display font-semibold text-foreground mb-1">
                  Instale o App
                </h3>
                <p className="text-muted-foreground text-sm font-body mb-3">
                  Funciona offline e carrega mais rápido!
                </p>
                
                <Link to="/install">
                  <Button
                    size="sm"
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    Ver Como Instalar
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </>
  );
};

export default InstallBanner;