import { useEffect, useRef } from "react";

interface ScrollScrubVideoProps {
  src: string;
  className?: string;
  /** Scroll distance (in px) over which the video plays fully. Defaults to window.innerHeight. */
  scrollDistance?: number;
}

/**
 * Background video whose currentTime is driven by window scrollY.
 * Scrolling down advances the video; scrolling up rewinds it.
 */
const ScrollScrubVideo = ({ src, className, scrollDistance }: ScrollScrubVideoProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const targetTimeRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const readyRef = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoaded = () => {
      readyRef.current = true;
      update();
    };

    const computeTarget = () => {
      const distance = scrollDistance ?? window.innerHeight;
      const progress = Math.min(1, Math.max(0, window.scrollY / distance));
      const duration = video.duration || 0;
      targetTimeRef.current = progress * duration;
    };

    const update = () => {
      if (!readyRef.current) return;
      const current = video.currentTime;
      const target = targetTimeRef.current;
      const diff = target - current;
      // Smoothly ease toward target for a fluid feel
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

    const handleScroll = () => {
      computeTarget();
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(update);
      }
    };

    video.addEventListener("loadedmetadata", handleLoaded);
    if (video.readyState >= 1) handleLoaded();

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    // Prime initial position
    computeTarget();

    return () => {
      video.removeEventListener("loadedmetadata", handleLoaded);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [scrollDistance]);

  return (
    <video
      ref={videoRef}
      src={src}
      className={className}
      muted
      playsInline
      preload="auto"
      // Do not autoplay: currentTime is driven by scroll
      // Poster kept blank; the first frame paints as soon as metadata loads
    />
  );
};

export default ScrollScrubVideo;
