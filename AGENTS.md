# Project Engineering Rules

- Register the generated app service worker only through `src/lib/registerAppServiceWorker.ts`; this prevents stale app files in Lovable previews and unsupported contexts.- Keep app media as plain files in `public/media` (not CDN pointers); the site must also deploy on Vercel/GitHub, where Lovable's CDN paths do not exist.
