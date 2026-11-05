import { memo, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Calendar, Phone, Camera } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useAdminEdit } from "@/contexts/AdminEditContext";
import EditableText from "@/components/admin/EditableText";
import EditableImage from "@/components/admin/EditableImage";
import heroImageDefault from "@/assets/hero-nails.jpg";
import portraitImg from "@/assets/jessica-portrait.png";
import heroVideoOptimized from "@/assets/hero-bg-optimized.mp4";
import heroVideoPoster from "@/assets/hero-bg-poster.jpg";
import logoJMDefault from "@/assets/logo-jm.png";
import ServiceMarquee from "@/components/ServiceMarquee";

interface HeroProps {
  onBookClick: () => void;
  whatsappNumber: string;
}

const Hero = memo(({ onBookClick, whatsappNumber }: HeroProps) => {
  const { getSetting } = useSiteSettings();
  const { isEditMode, isAdmin, openImageModal, getDraftSetting } = useAdminEdit();
  
  const heroPortrait = getDraftSetting("hero_portrait_url") || getSetting("hero_portrait_url", "") || portraitImg;
  const logoUrl = getDraftSetting("logo_url") || getSetting("logo_url", "");
  const logo = logoUrl || logoJMDefault;
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
      portrait.style.transform = `translate3d(0, 0, 0) scale(${1 - progress * 0.05})`;
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
    <section className="relative min-h-screen flex flex-col justify-between items-center overflow-hidden pt-28 pb-0">
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
      <div className="relative z-10 container mx-auto px-6 text-center my-auto">
        <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div
            ref={portraitRef}
            className="mb-8 flex justify-center will-change-transform animate-portrait-fade-in"
          >
            {/* Foto de Cima: Retrato com suporte a troca em tempo real */}
            <div className="relative w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 group/portrait">
              <img
                src={heroPortrait}
                alt="Jéssica Magalhães"
                className="w-full h-full object-cover object-top rounded-full"
                style={{
                  WebkitMaskImage:
                    "radial-gradient(ellipse at center, black 55%, transparent 78%)",
                  maskImage:
                    "radial-gradient(ellipse at center, black 55%, transparent 78%)",
                  transform: "translate3d(0, 0, 0)",
                  backfaceVisibility: "hidden",
                }}
              />
              <div
                className="absolute inset-x-0 bottom-0 h-2/3 pointer-events-none rounded-full"
                style={{
                  background:
                    "linear-gradient(to bottom, transparent 0%, hsl(var(--background) / 0.6) 55%, hsl(var(--background)) 100%)",
                }}
              />

              {/* Botão de edição da foto de cima no Modo Edição */}
              {isAdmin && isEditMode && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openImageModal("hero_portrait_url", heroPortrait, "Foto de Jéssica (Retrato Superior)");
                  }}
                  className="absolute top-4 right-4 z-30 px-3 py-1.5 rounded-full bg-black/75 hover:bg-primary text-white shadow-lg backdrop-blur-sm transition-all duration-200 flex items-center gap-1.5 text-xs font-sans hover:scale-105 cursor-pointer"
                  title="Trocar Foto de Jéssica"
                >
                  <Camera className="h-4 w-4" />
                  <span>Trocar Foto</span>
                </button>
              )}

              {/* Logo centralizada sobre a foto com troca no Modo Edição */}
              <div className="absolute bottom-2 sm:bottom-3 md:bottom-4 left-1/2 -translate-x-1/2 flex items-center justify-center z-10 group/logo">
                <img
                  src={logo}
                  alt="Logo Jéssica Magalhães"
                  className="h-20 sm:h-24 md:h-28 w-auto object-contain drop-shadow-md pointer-events-none"
                />
                {isAdmin && isEditMode && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openImageModal("logo_url", logo, "Logo Centralizada");
                    }}
                    className="absolute -top-2 -right-4 p-1.5 rounded-full bg-primary text-primary-foreground shadow-md hover:scale-110 transition-transform cursor-pointer"
                    title="Trocar Logo"
                  >
                    <Camera className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="mb-3 sm:mb-4 animate-in fade-in zoom-in-95 duration-500 delay-150">
            <EditableText
              settingKey="hero_subtitle"
              defaultValue="Nail Designer"
              as="span"
              className="inline-block uppercase tracking-[0.3em] text-primary font-body font-medium text-xs text-center"
            />
          </div>

          <div className="mb-4 sm:mb-6 animate-in fade-in slide-in-from-bottom-2 duration-600 delay-300">
            <EditableText
              settingKey="hero_title"
              defaultValue="Jéssica Magalhães"
              as="h1"
              className="text-3xl sm:text-5xl md:text-7xl font-display font-semibold text-foreground leading-tight"
            />
          </div>

          <div className="mb-8 sm:mb-10 max-w-md mx-auto animate-in fade-in duration-600 delay-500">
            <EditableText
              settingKey="hero_description"
              defaultValue="Unhas perfeitas com carinho e profissionalismo. Agende seu horário e sinta-se ainda mais linda!"
              as="p"
              multiline
              className="text-base sm:text-lg text-muted-foreground font-body px-2"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center w-full max-w-xs sm:max-w-md mx-auto animate-in fade-in slide-in-from-bottom-2 duration-500 delay-700">
            <Button
              size="lg"
              onClick={isEditMode ? undefined : onBookClick}
              className="w-full sm:w-auto h-12 sm:h-11 px-8 bg-primary hover:bg-primary/90 text-primary-foreground shadow-button font-body group text-base active:scale-[0.98] transition-transform"
            >
              <Calendar className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" />
              <EditableText
                settingKey="hero_btn_book"
                defaultValue="Agendar Horário"
                as="span"
              />
            </Button>

            <Button
              size="lg"
              variant="outline"
              onClick={isEditMode ? undefined : handleWhatsAppClick}
              className="w-full sm:w-auto h-12 sm:h-11 px-8 border-primary text-primary hover:bg-primary/10 font-body group text-base active:scale-[0.98] transition-transform"
            >
              <Phone className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" />
              <EditableText
                settingKey="hero_btn_whatsapp"
                defaultValue="WhatsApp"
                as="span"
              />
            </Button>
          </div>
        </div>
      </div>

      {/* Faixa Rolante de Serviços abaixo de Agendar Horário */}
      <div className="relative z-20 w-full mt-auto">
        <ServiceMarquee />
      </div>
    </section>
  );
});

Hero.displayName = "Hero";

export default Hero;
