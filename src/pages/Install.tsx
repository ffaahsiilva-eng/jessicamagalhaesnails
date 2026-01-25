import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Download, Check, Smartphone, Zap, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { useSiteSettings } from "@/hooks/useSiteSettings";

const Install = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const { getSetting } = useSiteSettings();
  const whatsappNumber = getSetting("whatsapp_number", "559191837179");

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Listen for install prompt
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setIsInstalled(true);
    }

    setDeferredPrompt(null);
  };

  const features = [
    {
      icon: Zap,
      title: "Carregamento Rápido",
      description: "Acesso instantâneo, mesmo com conexão lenta",
    },
    {
      icon: Wifi,
      title: "Funciona Offline",
      description: "Navegue pelo site mesmo sem internet",
    },
    {
      icon: Smartphone,
      title: "Como um App Real",
      description: "Ícone na tela inicial, tela cheia, sem navegador",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navigation onLoginClick={() => {}} onBookClick={() => {}} />

      <div className="container mx-auto px-4 py-16 max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Download className="w-10 h-10 text-primary" />
          </div>

          <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-4">
            Instale o App
          </h1>
          <p className="text-muted-foreground text-lg font-body">
            Tenha acesso rápido e funcione offline
          </p>
        </motion.div>

        {isInstalled ? (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center"
          >
            <Check className="w-16 h-16 text-emerald-600 mx-auto mb-4" />
            <h2 className="font-display text-2xl font-semibold text-emerald-900 mb-2">
              App Instalado!
            </h2>
            <p className="text-emerald-700 font-body">
              O app está instalado e pronto para usar offline.
            </p>
          </motion.div>
        ) : (
          <>
            {/* Features Grid */}
            <div className="grid md:grid-cols-3 gap-6 mb-12">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-card border border-border rounded-2xl p-6 text-center"
                >
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-display text-lg font-semibold text-foreground mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground text-sm font-body">
                    {feature.description}
                  </p>
                </motion.div>
              ))}
            </div>

            {/* Install Instructions */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="bg-card border border-border rounded-2xl p-8"
            >
              {isIOS ? (
                <>
                  <h2 className="font-display text-2xl font-semibold text-foreground mb-4">
                    Como Instalar no iPhone
                  </h2>
                  <ol className="space-y-4 font-body text-muted-foreground">
                    <li className="flex gap-3">
                      <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold">
                        1
                      </span>
                      <span>
                        Toque no botão <strong>Compartilhar</strong> (quadrado com seta) na barra inferior do Safari
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold">
                        2
                      </span>
                      <span>
                        Role para baixo e toque em <strong>"Adicionar à Tela de Início"</strong>
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold">
                        3
                      </span>
                      <span>Toque em <strong>Adicionar</strong> no canto superior direito</span>
                    </li>
                  </ol>
                </>
              ) : deferredPrompt ? (
                <>
                  <h2 className="font-display text-2xl font-semibold text-foreground mb-6 text-center">
                    Pronto para Instalar!
                  </h2>
                  <Button
                    onClick={handleInstall}
                    size="lg"
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-button"
                  >
                    <Download className="w-5 h-5 mr-2" />
                    Instalar Agora
                  </Button>
                </>
              ) : (
                <>
                  <h2 className="font-display text-2xl font-semibold text-foreground mb-4">
                    Como Instalar no Android
                  </h2>
                  <ol className="space-y-4 font-body text-muted-foreground">
                    <li className="flex gap-3">
                      <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold">
                        1
                      </span>
                      <span>
                        Toque no menu <strong>⋮</strong> no canto superior direito do Chrome
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold">
                        2
                      </span>
                      <span>
                        Toque em <strong>"Instalar app"</strong> ou <strong>"Adicionar à tela inicial"</strong>
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold">
                        3
                      </span>
                      <span>Confirme tocando em <strong>Instalar</strong></span>
                    </li>
                  </ol>
                </>
              )}
            </motion.div>
          </>
        )}
      </div>

      <Footer whatsappNumber={whatsappNumber} />
    </div>
  );
};

export default Install;