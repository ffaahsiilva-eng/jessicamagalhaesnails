# Project Engineering Rules

- Register the generated app service worker only through `src/lib/registerAppServiceWorker.ts`; this prevents stale app files in Lovable previews and unsupported contexts.