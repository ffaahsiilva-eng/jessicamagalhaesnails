import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useThemeColors } from "./hooks/useThemeColors";
import { useFonts } from "./hooks/useFonts";
import { usePerformanceMonitor } from "./hooks/usePerformanceMonitor";
import ErrorBoundary from "./components/ErrorBoundary";
import SuspenseFallback from "./components/SuspenseFallback";
import UpdatePrompt from "./components/UpdatePrompt";

// Lazy load pages for better performance
const Index = lazy(() => import("./pages/Index"));
const Admin = lazy(() => import("./pages/Admin"));
const Install = lazy(() => import("./pages/Install"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Optimized QueryClient with retry logic and caching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0, // Always refetch fresh data
      gcTime: 1000 * 60 * 5, // 5 minutes
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchOnMount: true,
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
  usePerformanceMonitor(process.env.NODE_ENV === "development");
  return <>{children}</>;
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
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
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
