import { useEffect, useCallback, useRef } from "react";

interface PerformanceMetrics {
  pageLoadTime: number;
  firstContentfulPaint: number | null;
  largestContentfulPaint: number | null;
  cumulativeLayoutShift: number;
  firstInputDelay: number | null;
  longTasks: number;
}

interface LayoutShiftEntry {
  hadRecentInput?: boolean;
  value?: number;
}

interface FirstInputEntry {
  processingStart: number;
  startTime: number;
}

export const usePerformanceMonitor = (enabled = true) => {
  const metricsRef = useRef<PerformanceMetrics>({
    pageLoadTime: 0,
    firstContentfulPaint: null,
    largestContentfulPaint: null,
    cumulativeLayoutShift: 0,
    firstInputDelay: null,
    longTasks: 0,
  });

  const logMetrics = useCallback(() => {
    if (!enabled) return;
    
    const metrics = metricsRef.current;
    
    // Performance logging (only in development or when issues are detected)
    if (process.env.NODE_ENV === "development") {
      console.log("📊 Performance Metrics:", {
        ...metrics,
        timestamp: new Date().toISOString(),
      });
    }

    // Warn about poor performance
    if (metrics.largestContentfulPaint && metrics.largestContentfulPaint > 2500) {
      console.warn("⚠️ LCP is slow:", metrics.largestContentfulPaint, "ms");
    }
    if (metrics.cumulativeLayoutShift > 0.1) {
      console.warn("⚠️ CLS is high:", metrics.cumulativeLayoutShift);
    }
    if (metrics.longTasks > 5) {
      console.warn("⚠️ Many long tasks detected:", metrics.longTasks);
    }

    return metrics;
  }, [enabled]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || !("PerformanceObserver" in window)) {
      return;
    }

    const observers: PerformanceObserver[] = [];

    // Page Load Time
    if (performance.timing) {
      metricsRef.current.pageLoadTime = 
        performance.timing.loadEventEnd - performance.timing.navigationStart;
    }

    // First Contentful Paint
    try {
      const fcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const fcpEntry = entries.find((entry) => entry.name === "first-contentful-paint");
        if (fcpEntry) {
          metricsRef.current.firstContentfulPaint = fcpEntry.startTime;
        }
      });
      fcpObserver.observe({ type: "paint", buffered: true });
      observers.push(fcpObserver);
    } catch (e) {
      // Observer not supported
    }

    // Largest Contentful Paint
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        if (lastEntry) {
          metricsRef.current.largestContentfulPaint = lastEntry.startTime;
        }
      });
      lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
      observers.push(lcpObserver);
    } catch (e) {
      // Observer not supported
    }

    // Cumulative Layout Shift
    try {
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const layoutEntry = entry as unknown as LayoutShiftEntry;
          if (!layoutEntry.hadRecentInput && layoutEntry.value) {
            metricsRef.current.cumulativeLayoutShift += layoutEntry.value;
          }
        }
      });
      clsObserver.observe({ type: "layout-shift", buffered: true });
      observers.push(clsObserver);
    } catch (e) {
      // Observer not supported
    }

    // First Input Delay
    try {
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const firstEntry = entries[0] as unknown as FirstInputEntry | undefined;
        if (firstEntry && firstEntry.processingStart) {
          metricsRef.current.firstInputDelay = 
            firstEntry.processingStart - firstEntry.startTime;
        }
      });
      fidObserver.observe({ type: "first-input", buffered: true });
      observers.push(fidObserver);
    } catch (e) {
      // Observer not supported
    }

    // Long Tasks
    try {
      const longTaskObserver = new PerformanceObserver((list) => {
        metricsRef.current.longTasks += list.getEntries().length;
      });
      longTaskObserver.observe({ type: "longtask", buffered: true });
      observers.push(longTaskObserver);
    } catch (e) {
      // Observer not supported
    }

    // Log metrics after page load
    const timeoutId = setTimeout(logMetrics, 3000);

    return () => {
      clearTimeout(timeoutId);
      observers.forEach((observer) => observer.disconnect());
    };
  }, [enabled, logMetrics]);

  return { getMetrics: logMetrics };
};
