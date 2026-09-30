import { registerSW } from "virtual:pwa-register";

const APP_WORKER_PATH = "/sw.js";

const isMatchingAppWorker = (registration: ServiceWorkerRegistration) => {
  const workerUrl = registration.active?.scriptURL
    ?? registration.waiting?.scriptURL
    ?? registration.installing?.scriptURL;

  if (!workerUrl) return false;

  try {
    return new URL(workerUrl).pathname === APP_WORKER_PATH;
  } catch {
    return false;
  }
};

const unregisterAppWorker = async () => {
  if (!("serviceWorker" in navigator)) return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    registrations
      .filter(isMatchingAppWorker)
      .map((registration) => registration.unregister()),
  );
};

export const registerAppServiceWorker = async () => {
  if (!("serviceWorker" in navigator)) return;

  const hostname = window.location.hostname;
  const isFramed = window.parent !== window;
  const isPreviewHostname =
    hostname.startsWith("id-preview--")
    || hostname.startsWith("preview--")
    || hostname === "lovableproject.com"
    || hostname.endsWith(".lovableproject.com")
    || hostname === "lovableproject-dev.com"
    || hostname.endsWith(".lovableproject-dev.com")
    || hostname === "beta.lovable.dev"
    || hostname.endsWith(".beta.lovable.dev");
  const registrationDisabled = new URLSearchParams(window.location.search).get("sw") === "off";

  if (!import.meta.env.PROD || isFramed || isPreviewHostname || registrationDisabled) {
    await unregisterAppWorker();
    return;
  }

  registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      window.setInterval(() => registration.update(), 60 * 60 * 1000);
    },
    onRegisterError(error) {
      console.error("Falha ao atualizar o aplicativo offline", error);
    },
  });
};