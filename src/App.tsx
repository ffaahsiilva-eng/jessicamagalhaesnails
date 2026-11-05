import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useThemeColors } from "./hooks/useThemeColors";
import { useFonts } from "./hooks/useFonts";
import { usePerformanceMonitor } from "./hooks/usePerformanceMonitor";
import { AdminEditProvider } from "@/contexts/AdminEditContext";
import ErrorBoundary from "./components/ErrorBoundary";
import SuspenseFallback from "./components/SuspenseFallback";
import UpdatePrompt from "./components/UpdatePrompt";

// Direct import for homepage to prevent dynamic chunk load errors on iOS
import Index from "./pages/Index";

// Lazy load secondary admin & utility pages with safe error handling
const Admin = lazy(() => import("./pages/Admin"));
const Install = lazy(() => import("./pages/Install"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Optimized QueryClient with retry logic and caching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false, // Desabilita atualização automática ao mudar de aba/janela
      refetchOnReconnect: false,
      refetchOnMount: false,
    },
    mutations: {
      retry: 2,
      retryDelay: 1000,
    },
  },
});

const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  useThemeColors();
  useFonts();
  usePerformanceMonitor(Boolean(import.meta.env.DEV));
  return <>{children}</>;
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AdminEditProvider>
          <ThemeProvider>
            <Toaster />
            <Sonner />
            <UpdatePrompt />
            <BrowserRouter>
              <ErrorBoundary>
                <Suspense fallback={<SuspenseFallback type="page" />}>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/admin" element={<Admin />} />
                    <Route path="/install" element={<Install />} />
                    {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </ErrorBoundary>
            </BrowserRouter>
          </ThemeProvider>
        </AdminEditProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
