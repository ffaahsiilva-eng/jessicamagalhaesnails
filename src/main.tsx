import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Register Service Worker for PWA offline support
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("✅ Service Worker registrado:", registration);
        
        // Auto-update on new version
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                console.log("🔄 Nova versão disponível, atualizando...");
                window.location.reload();
              }
            });
          }
        });
      })
      .catch((error) => {
        console.error("❌ Erro ao registrar Service Worker:", error);
      });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
