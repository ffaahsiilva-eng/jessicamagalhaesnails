import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

function localApiPlugin() {
  return {
    name: "local-api-middleware",
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (req.url?.startsWith("/api/create-mercadopago-checkout")) {
          try {
            const { default: handler } = await import("./api/create-mercadopago-checkout.js");
            let body = "";
            req.on("data", (chunk: any) => (body += chunk));
            req.on("end", async () => {
              req.body = body ? JSON.parse(body) : {};
              const resAdapter = {
                setHeader: (k: string, v: string) => res.setHeader(k, v),
                status: (code: number) => ({
                  json: (data: any) => {
                    res.statusCode = code;
                    res.setHeader("Content-Type", "application/json");
                    res.end(JSON.stringify(data));
                  },
                  end: () => {
                    res.statusCode = code;
                    res.end();
                  },
                }),
              };
              await handler(req, resAdapter);
            });
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        if (req.url?.startsWith("/api/check-mercadopago-payment")) {
          try {
            const { default: handler } = await import("./api/check-mercadopago-payment.js");
            let body = "";
            req.on("data", (chunk: any) => (body += chunk));
            req.on("end", async () => {
              req.body = body ? JSON.parse(body) : {};
              const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
              req.query = Object.fromEntries(parsedUrl.searchParams.entries());
              const resAdapter = {
                setHeader: (k: string, v: string) => res.setHeader(k, v),
                status: (code: number) => ({
                  json: (data: any) => {
                    res.statusCode = code;
                    res.setHeader("Content-Type", "application/json");
                    res.end(JSON.stringify(data));
                  },
                  end: () => {
                    res.statusCode = code;
                    res.end();
                  },
                }),
              };
              await handler(req, resAdapter);
            });
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        if (req.url?.startsWith("/api/mercadopago-webhook")) {
          try {
            const { default: handler } = await import("./api/mercadopago-webhook.js");
            let body = "";
            req.on("data", (chunk: any) => (body += chunk));
            req.on("end", async () => {
              req.body = body ? JSON.parse(body) : {};
              const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
              req.query = Object.fromEntries(parsedUrl.searchParams.entries());
              const resAdapter = {
                setHeader: (k: string, v: string) => res.setHeader(k, v),
                status: (code: number) => ({
                  json: (data: any) => {
                    res.statusCode = code;
                    res.setHeader("Content-Type", "application/json");
                    res.end(JSON.stringify(data));
                  },
                  end: () => {
                    res.statusCode = code;
                    res.end();
                  },
                }),
              };
              await handler(req, resAdapter);
            });
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        if (req.url?.startsWith("/api/create-infinitepay-checkout")) {
          try {
            const { default: handler } = await import("./api/create-infinitepay-checkout.js");
            let body = "";
            req.on("data", (chunk: any) => (body += chunk));
            req.on("end", async () => {
              req.body = body ? JSON.parse(body) : {};
              const resAdapter = {
                setHeader: (k: string, v: string) => res.setHeader(k, v),
                status: (code: number) => ({
                  json: (data: any) => {
                    res.statusCode = code;
                    res.setHeader("Content-Type", "application/json");
                    res.end(JSON.stringify(data));
                  },
                  end: () => {
                    res.statusCode = code;
                    res.end();
                  },
                }),
              };
              await handler(req, resAdapter);
            });
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        if (req.url?.startsWith("/api/check-infinitepay-payment")) {
          try {
            const { default: handler } = await import("./api/check-infinitepay-payment.js");
            let body = "";
            req.on("data", (chunk: any) => (body += chunk));
            req.on("end", async () => {
              req.body = body ? JSON.parse(body) : {};
              const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
              req.query = Object.fromEntries(parsedUrl.searchParams.entries());
              const resAdapter = {
                setHeader: (k: string, v: string) => res.setHeader(k, v),
                status: (code: number) => ({
                  json: (data: any) => {
                    res.statusCode = code;
                    res.setHeader("Content-Type", "application/json");
                    res.end(JSON.stringify(data));
                  },
                  end: () => {
                    res.statusCode = code;
                    res.end();
                  },
                }),
              };
              await handler(req, resAdapter);
            });
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        if (req.url?.startsWith("/api/infinitepay-webhook")) {
          try {
            const { default: handler } = await import("./api/infinitepay-webhook.js");
            let body = "";
            req.on("data", (chunk: any) => (body += chunk));
            req.on("end", async () => {
              req.body = body ? JSON.parse(body) : {};
              const resAdapter = {
                setHeader: (k: string, v: string) => res.setHeader(k, v),
                status: (code: number) => ({
                  json: (data: any) => {
                    res.statusCode = code;
                    res.setHeader("Content-Type", "application/json");
                    res.end(JSON.stringify(data));
                  },
                  end: () => {
                    res.statusCode = code;
                    res.end();
                  },
                }),
              };
              await handler(req, resAdapter);
            });
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        next();
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    proxy: {
      "/api/wapi": {
        target: "https://api.w-api.app",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/wapi/, ""),
      },
    },
  },
  plugins: [
    localApiPlugin(),
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "robots.txt", "placeholder.svg", "pwa-icon-192.png", "pwa-icon-512.png", "apple-touch-icon.png"],
      manifest: {
        name: "Jessica Magalhães - Nail Designer",
        short_name: "JM Nails",
        description: "Agendamento de serviços de nail designer profissional",
        theme_color: "#d4838c",
        background_color: "#faf8f7",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        lang: "pt-BR",
        dir: "ltr",
        categories: ["beauty", "lifestyle"],
        icons: [
          {
            src: "/pwa-icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa-icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa-icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,jpg,jpeg,svg,gif,webp,woff,woff2,ttf,eot}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "gstatic-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "images-cache",
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    include: ["react", "react-dom"],
  },
}));
