import { memo, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Calendar, Phone } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useAdminEdit } from "@/contexts/AdminEditContext";
import EditableText from "@/components/admin/EditableText";
import EditableImage from "@/components/admin/EditableImage";
import heroImageDefault from "@/assets/hero-nails.jpg";
import portraitAsset from "@/assets/jessica-portrait.png.asset.json";
import heroVideoOptimized from "@/assets/hero-bg-optimized.mp4";
import heroVideoPoster from "@/assets/hero-bg-poster.jpg";

interface HeroProps {
  onBookClick: () => void;
  whatsappNumber: string;
}

const Hero = memo(({ onBookClick, whatsappNumber }: HeroProps) => {
  const { getSetting } = useSiteSettings();
  const { isEditMode, isAdmin } = useAdminEdit();
  const sectionRef = useRef<HTMLElement>(null);
  const pinnedRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollIndicatorRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pinned = !(isAdmin && isEditMode);

  // Load the video as a Blob URL so the browser has the full file in memory —
  // the dev server doesn't support HTTP Range requests, and without them
  // `currentTime = t` seeks silently fail, breaking the scrub.
  useEffect(() => {
    if (!pinned) return;
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;
    let blobUrl: string | null = null;
    fetch(heroVideoOptimized)
      .then((r) => r.blob())
      .then((blob) => {
        if (cancelled) return;
        blobUrl = URL.createObjectURL(blob);
        video.src = blobUrl;
        video.load();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [pinned]);

  // Scrub video based on scroll while section is pinned
  useEffect(() => {
    if (!pinned) return;
    const section = sectionRef.current;
    const video = videoRef.current;
    const indicator = scrollIndicatorRef.current;
    if (!section || !video) return;

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.pause();

    let duration = video.duration && isFinite(video.duration) ? video.duration : 0;
    const onMeta = () => {
      duration = video.duration && isFinite(video.duration) ? video.duration : 0;
      update();
    };
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("durationchange", onMeta);

    const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));

    let rafId: number | null = null;
    const update = () => {
      rafId = null;
      const vh = window.innerHeight || 800;
      const rect = section.getBoundingClientRect();
      const pinDistance = section.offsetHeight - vh;
      const scrolled = Math.min(Math.max(-rect.top, 0), pinDistance);
      const progress = pinDistance > 0 ? scrolled / pinDistance : 0;

      // Scrub the video across the full pin — no zoom, no content movement.
      // The hero stays completely still; only the video frames advance
      // as the user scrolls.
      if (duration) {
        const t = clamp(progress) * duration;
        if (Math.abs(video.currentTime - t) > 0.03) {
          try {
            video.currentTime = t;
          } catch {}
        }
      }

      if (indicator) {
        indicator.style.opacity = `${1 - clamp(progress / 0.15)}`;
      }
    };

    const request = () => {
      if (rafId === null) rafId = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request);
    return () => {
      window.removeEventListener("scroll", request);
      window.removeEventListener("resize", request);
      video.removeEventListener("loadedmetadata", onMeta);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, [pinned]);

  const handleWhatsAppClick = useCallback(() => {
    const message = encodeURIComponent("Olá! Gostaria de agendar um horário.");
    window.open(`https://wa.me/${whatsappNumber}?text=${message}`, "_blank");
  }, [whatsappNumber]);

  return (
    <section
      ref={sectionRef}
      className={pinned ? "relative w-full" : "relative min-h-screen flex items-center justify-center overflow-hidden"}
      style={pinned ? { height: "300vh" } : undefined}
    >
      <div
        ref={pinnedRef}
        className={pinned ? "sticky top-0 h-screen w-full overflow-hidden flex items-center justify-center" : "contents"}
      >
        {/* Background: scrubbed video (admin edit mode falls back to editable image) */}
        <div className="absolute inset-0 z-0">
          {isAdmin && isEditMode ? (
            <EditableImage
              settingKey="hero_image_url"
              defaultImage={heroImageDefault}
              alt="Manicure profissional"
              className="w-full h-full object-cover"
            />
          ) : (
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              muted
              playsInline
              preload="auto"
              poster={heroVideoPoster}
              disablePictureInPicture
            >
              <source src={heroVideoOptimized} type="video/mp4" />
            </video>
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/50 to-background pointer-events-none" />
        </div>

        {/* Content overlay — fades out as user scrolls through the pin */}
        <div
          ref={contentRef}
          className="relative z-10 container mx-auto px-6 text-center will-change-transform"
        >
          <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="mb-6 flex justify-center opacity-0 animate-portrait-fade-in">
              <div className="relative w-72 h-72 sm:w-80 sm:h-80 md:w-96 md:h-96">
                <img
                  src={portraitAsset.url}
                  alt="Jéssica Magalhães"
                  className="w-full h-full object-cover object-top rounded-full"
                  style={{
                    WebkitMaskImage:
                      "radial-gradient(ellipse at center, black 55%, transparent 78%)",
                    maskImage:
                      "radial-gradient(ellipse at center, black 55%, transparent 78%)",
                  }}
                />
                <div
                  className="absolute inset-x-0 bottom-0 h-2/3 pointer-events-none rounded-full"
                  style={{
                    background:
                      "linear-gradient(to bottom, transparent 0%, hsl(var(--background) / 0.6) 55%, hsl(var(--background)) 100%)",
                  }}
                />
              </div>
            </div>

            <div className="mb-4 animate-in fade-in zoom-in-95 duration-500 delay-150">
              {isAdmin && isEditMode ? (
                <EditableText
                  settingKey="hero_subtitle"
                  defaultValue="Nail Designer"
                  className="inline-block uppercase tracking-[0.3em] text-primary font-body font-medium text-xs text-center"
                />
              ) : (
                <span className="inline-block uppercase tracking-[0.3em] text-primary font-body font-medium text-xs text-center">
                  {getSetting("hero_subtitle", "Nail Designer")}
                </span>
              )}
            </div>

            <div className="mb-6 animate-in fade-in slide-in-from-bottom-2 duration-600 delay-300">
              {isAdmin && isEditMode ? (
                <EditableText
                  settingKey="hero_title"
                  defaultValue="Jéssica Magalhães"
                  as="h1"
                  className="md:text-7xl font-display font-semibold text-foreground leading-tight text-4xl"
                />
              ) : (
                <h1 className="md:text-7xl font-display font-semibold text-foreground mb-6 leading-tight text-4xl">
                  {getSetting("hero_title", "Jéssica Magalhães")}
                </h1>
              )}
            </div>

            <div className="mb-10 max-w-md mx-auto animate-in fade-in duration-600 delay-500">
              {isAdmin && isEditMode ? (
                <EditableText
                  settingKey="hero_description"
                  defaultValue="Unhas perfeitas com carinho e profissionalismo. Agende seu horário e sinta-se ainda mais linda!"
                  as="p"
                  multiline
                  className="text-lg text-muted-foreground font-body"
                />
              ) : (
                <p className="text-lg text-muted-foreground font-body">
                  {getSetting("hero_description", "Unhas perfeitas com carinho e profissionalismo. Agende seu horário e sinta-se ainda mais linda!")}
                </p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-in fade-in slide-in-from-bottom-2 duration-500 delay-700">
              <Button
                size="lg"
                onClick={onBookClick}
                className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-button font-body group"
              >
                <Calendar className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" />
                Agendar Horário
              </Button>

              <Button
                size="lg"
                variant="outline"
                onClick={handleWhatsAppClick}
                className="border-primary text-primary hover:bg-primary/10 font-body group"
              >
                <Phone className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" />
                WhatsApp
              </Button>
            </div>
          </div>
        </div>

        {/* Decorative Scroll Indicator */}
        <div
          ref={scrollIndicatorRef}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10 animate-bounce"
        >
          <div className="w-6 h-10 border-2 border-primary/50 rounded-full flex justify-center pt-2">
            <div className="w-1.5 h-3 bg-primary rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    </section>
  );
});

Hero.displayName = "Hero";

export default Hero;
