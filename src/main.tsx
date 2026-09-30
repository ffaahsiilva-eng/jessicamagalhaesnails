import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerAppServiceWorker } from "./lib/registerAppServiceWorker";

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

void registerAppServiceWorker();

// Performance mark for render complete
if (typeof performance !== "undefined") {
  const markRenderComplete = () => {
    performance.mark("app-init-end");
    performance.measure("app-initialization", "app-init-start", "app-init-end");
    
    const measures = performance.getEntriesByName("app-initialization");
    if (measures.length > 0 && process.env.NODE_ENV === "development") {
      console.log(`⚡ App initialized in ${measures[0].duration.toFixed(2)}ms`);
    }
  };

  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(markRenderComplete);
  } else {
    window.setTimeout(markRenderComplete, 0);
  }
}
