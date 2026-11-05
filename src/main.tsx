import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Polyfill requestIdleCallback / cancelIdleCallback for iOS Safari / WebKit
if (typeof window !== "undefined") {
  if (!("requestIdleCallback" in window)) {
    (window as unknown as { requestIdleCallback: unknown }).requestIdleCallback = function (
      cb: (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void
    ) {
      const start = Date.now();
      return window.setTimeout(() => {
        cb({
          didTimeout: false,
          timeRemaining: () => Math.max(0, 50 - (Date.now() - start)),
        });
      }, 1);
    };
  }

  if (!("cancelIdleCallback" in window)) {
    (window as unknown as { cancelIdleCallback: unknown }).cancelIdleCallback = function (id: number) {
      clearTimeout(id);
    };
  }
}

// Global error handler for unhandled errors
window.onerror = (message, source, lineno, colno, error) => {
  console.error("🔴 Global Error:", { message, source, lineno, colno, error });
  return false;
};

// Global promise rejection handler
window.onunhandledrejection = (event) => {
  console.error("🔴 Unhandled Promise Rejection:", event.reason);
};

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

// Performance mark for render complete (seguro contra WebKit / iOS Safari)
if (typeof performance !== "undefined" && typeof window !== "undefined") {
  const scheduleIdle = window.requestIdleCallback || window.setTimeout;
  scheduleIdle(() => {
    try {
      performance.mark("app-init-end");
      performance.measure("app-initialization", "app-init-start", "app-init-end");

      const measures = performance.getEntriesByName("app-initialization");
      if (measures.length > 0 && import.meta.env.DEV) {
        console.log(`⚡ App initialized in ${measures[0].duration.toFixed(2)}ms`);
      }
    } catch {
      // Ignora erro de medição
    }
  });
}
