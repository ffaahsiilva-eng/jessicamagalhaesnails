import { memo, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Calendar, Phone } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useAdminEdit } from "@/contexts/AdminEditContext";
import EditableText from "@/components/admin/EditableText";
import EditableImage from "@/components/admin/EditableImage";
import heroImageDefault from "@/assets/hero-nails.jpg";
import portraitImg from "@/assets/jessica-portrait.png";
import heroVideoOptimized from "@/assets/hero-bg-optimized.mp4";
import heroVideoPoster from "@/assets/hero-bg-poster.jpg";

interface HeroProps {
  onBookClick: () => void;
  whatsappNumber: string;
}

const Hero = memo(({ onBookClick, whatsappNumber }: HeroProps) => {
  const { getSetting } = useSiteSettings();
  const { isEditMode, isAdmin } = useAdminEdit();
  const portraitRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let rafId: number | null = null;

    const updatePortrait = () => {
      const portrait = portraitRef.current;
      if (!portrait) {
        rafId = null;
        return;
      }

      const vh = window.innerHeight || 800;
      const progress = Math.min(0.4, Math.max(0, window.scrollY / (vh * 1.5)));
      portrait.style.opacity = `${1 - progress}`;
      portrait.style.transform = `translateZ(0) scale(${1 - progress * 0.05})`;
      rafId = null;
    };

    const requestUpdate = () => {
      if (rafId === null) {
        rafId = window.requestAnimationFrame(updatePortrait);
      }
    };

    requestUpdate();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    return () => {
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;

    const playVideo = () => {
      if (!video.paused && !video.ended) return;
      const playPromise = video.play();
      if (playPromise) playPromise.catch(() => undefined);
    };

    const handleVisibility = () => {
      if (!document.hidden) playVideo();
    };

    if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      playVideo();
    } else {
      video.addEventListener("canplay", playVideo, { once: true });
    }

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pageshow", playVideo);

    return () => {
      video.removeEventListener("canplay", playVideo);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pageshow", playVideo);
    };
  }, []);

  const handleWhatsAppClick = useCallback(() => {
    const message = encodeURIComponent("Olá! Gostaria de agendar um horário.");
    window.open(`https://wa.me/${whatsappNumber}?text=${message}`, "_blank");
  }, [whatsappNumber]);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background: looping video (admin edit mode falls back to editable image) */}
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
            className="w-full h-full object-cover motion-safe:transform-gpu"
            autoPlay
            muted
            loop
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

      {/* Content */}
      <div className="relative z-10 container mx-auto px-6 text-center">
        <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div
            ref={portraitRef}
            className="mb-6 flex justify-center will-change-transform animate-portrait-fade-in"
          >

            <div className="relative w-72 h-72 sm:w-80 sm:h-80 md:w-96 md:h-96">
              <img
                src={portraitImg}
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
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10 animate-bounce">
        <div className="w-6 h-10 border-2 border-primary/50 rounded-full flex justify-center pt-2">
          <div className="w-1.5 h-3 bg-primary rounded-full animate-pulse" />
        </div>
      </div>
    </section>
  );
});

Hero.displayName = "Hero";

export default Hero;
