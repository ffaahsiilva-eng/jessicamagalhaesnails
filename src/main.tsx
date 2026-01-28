import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Global error handler for unhandled errors
window.onerror = (message, source, lineno, colno, error) => {
  console.error("🔴 Global Error:", { message, source, lineno, colno, error });
  return false;
};

// Global promise rejection handler
window.onunhandledrejection = (event) => {
  console.error("🔴 Unhandled Promise Rejection:", event.reason);
};

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

// Performance mark for page start
if (typeof performance !== "undefined") {
  performance.mark("app-init-start");
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found. Make sure there is a div with id='root' in index.html");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Performance mark for render complete
if (typeof performance !== "undefined") {
  requestIdleCallback?.(() => {
    performance.mark("app-init-end");
    performance.measure("app-initialization", "app-init-start", "app-init-end");
    
    const measures = performance.getEntriesByName("app-initialization");
    if (measures.length > 0 && process.env.NODE_ENV === "development") {
      console.log(`⚡ App initialized in ${measures[0].duration.toFixed(2)}ms`);
    }
  }) ?? setTimeout(() => {
    performance.mark("app-init-end");
  }, 0);
}
