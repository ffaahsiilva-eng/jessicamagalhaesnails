import { useEffect, useRef } from "react";

interface ScrollScrubVideoProps {
  src: string;
  className?: string;
  /** Scroll distance (in px) over which the video plays fully. Defaults to window.innerHeight. Ignored when `progress` is provided. */
  scrollDistance?: number;
  /** Optional externally-controlled progress (0..1). When provided, window scroll is ignored. */
  progress?: number;
}

/**
 * Background video whose currentTime is driven either by window scrollY
 * or by an external `progress` value (0..1).
 */
const ScrollScrubVideo = ({ src, className, scrollDistance, progress }: ScrollScrubVideoProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const targetTimeRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const readyRef = useRef(false);
  const externalProgress = progress;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

    const computeFromScroll = () => {
      const distance = scrollDistance ?? window.innerHeight;
      return clamp01(window.scrollY / distance);
    };

    const setTargetFromProgress = (p: number) => {
      const duration = video.duration || 0;
      targetTimeRef.current = clamp01(p) * duration;
    };

    const update = () => {
      if (!readyRef.current) {
        rafRef.current = null;
        return;
      }
      const current = video.currentTime;
      const target = targetTimeRef.current;
      const diff = target - current;
      if (Math.abs(diff) > 0.01) {
        try {
          video.currentTime = current + diff * 0.25;
        } catch {
          /* ignore seek errors */
        }
        rafRef.current = requestAnimationFrame(update);
      } else {
        rafRef.current = null;
      }
    };

    const kickUpdate = () => {
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(update);
      }
    };

    const handleLoaded = () => {
      readyRef.current = true;
      if (externalProgress !== undefined) {
        setTargetFromProgress(externalProgress);
      } else {
        setTargetFromProgress(computeFromScroll());
      }
      kickUpdate();
    };

    video.addEventListener("loadedmetadata", handleLoaded);
    if (video.readyState >= 1) handleLoaded();

    let removeScroll: (() => void) | undefined;
    if (externalProgress === undefined) {
      const handleScroll = () => {
        setTargetFromProgress(computeFromScroll());
        kickUpdate();
      };
      window.addEventListener("scroll", handleScroll, { passive: true });
      window.addEventListener("resize", handleScroll);
      removeScroll = () => {
        window.removeEventListener("scroll", handleScroll);
        window.removeEventListener("resize", handleScroll);
      };
    }

    return () => {
      video.removeEventListener("loadedmetadata", handleLoaded);
      removeScroll?.();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [scrollDistance, externalProgress]);

  // React to external progress changes after mount
  useEffect(() => {
    const video = videoRef.current;
    if (!video || externalProgress === undefined) return;
    const duration = video.duration || 0;
    if (!duration) return;
    targetTimeRef.current = Math.min(1, Math.max(0, externalProgress)) * duration;
    if (rafRef.current === null) {
      const step = () => {
        const current = video.currentTime;
        const target = targetTimeRef.current;
        const diff = target - current;
        if (Math.abs(diff) > 0.01) {
          try {
            video.currentTime = current + diff * 0.25;
          } catch {
            /* ignore */
          }
          rafRef.current = requestAnimationFrame(step);
        } else {
          rafRef.current = null;
        }
      };
      rafRef.current = requestAnimationFrame(step);
    }
  }, [externalProgress]);

  return (
    <video
      ref={videoRef}
      src={src}
      className={className}
      muted
      playsInline
      preload="auto"
    />
  );
};

export default ScrollScrubVideo;
