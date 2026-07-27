import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar, Phone } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useAdminEdit } from "@/contexts/AdminEditContext";
import EditableText from "@/components/admin/EditableText";
import EditableImage from "@/components/admin/EditableImage";
import ScrollScrubVideo from "@/components/ScrollScrubVideo";
import heroImageDefault from "@/assets/hero-nails.jpg";
import portraitAsset from "@/assets/jessica-portrait.png.asset.json";
import heroVideoAsset from "@/assets/hero-bg.mp4.asset.json";

interface HeroProps {
  onBookClick: () => void;
  whatsappNumber: string;
}

const Hero = memo(({ onBookClick, whatsappNumber }: HeroProps) => {
  const { getSetting } = useSiteSettings();
  const { isEditMode, isAdmin } = useAdminEdit();

  const sectionRef = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(0);

  // Track scroll progress within the pinned hero (0 at top, 1 when the pin releases)
  useEffect(() => {
    if (isAdmin && isEditMode) return; // no pinning in edit mode

    const compute = () => {
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = el.offsetHeight - window.innerHeight;
      if (total <= 0) {
        setProgress(0);
        return;
      }
      const scrolled = Math.min(Math.max(-rect.top, 0), total);
      setProgress(scrolled / total);
    };

    compute();
    window.addEventListener("scroll", compute, { passive: true });
    window.addEventListener("resize", compute);
    return () => {
      window.removeEventListener("scroll", compute);
      window.removeEventListener("resize", compute);
    };
  }, [isAdmin, isEditMode]);

  const handleWhatsAppClick = useCallback(() => {
    const message = encodeURIComponent("Olá! Gostaria de agendar um horário.");
    window.open(`https://wa.me/${whatsappNumber}?text=${message}`, "_blank");
  }, [whatsappNumber]);

  const pinned = !(isAdmin && isEditMode);
  // Portrait fades out between ~10% and ~70% of the scrub
  const portraitOpacity = pinned
    ? Math.min(1, Math.max(0, 1 - (progress - 0.1) / 0.6))
    : 1;
  // Content gently fades near the end so the video can breathe before release
  const contentOpacity = pinned
    ? Math.min(1, Math.max(0, 1 - (progress - 0.55) / 0.35))
    : 1;

  return (
    <section
      ref={sectionRef}
      className={pinned ? "relative" : "relative min-h-screen flex items-center justify-center overflow-hidden"}
      style={pinned ? { height: "220vh" } : undefined}
    >
      <div
        className={
          pinned
            ? "sticky top-0 h-screen w-full overflow-hidden flex items-center justify-center"
            : "contents"
        }
      >
        {/* Background: scroll-scrubbed video (admin edit mode falls back to editable image) */}
        <div className="absolute inset-0 z-0">
          {isAdmin && isEditMode ? (
            <EditableImage
              settingKey="hero_image_url"
              defaultImage={heroImageDefault}
              alt="Manicure profissional"
              className="w-full h-full object-cover"
            />
          ) : (
            <ScrollScrubVideo
              src={heroVideoAsset.url}
              className="w-full h-full object-cover"
              progress={progress}
            />
          )}
          <div
            className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/50 to-background pointer-events-none transition-opacity duration-300"
            style={pinned ? { opacity: Math.max(0.15, 1 - progress * 0.85) } : undefined}
          />
        </div>

        {/* Content */}
        <div
          className="relative z-10 container mx-auto px-6 text-center transition-opacity"
          style={{ opacity: contentOpacity }}
        >
          <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div
              className="mb-6 flex justify-center animate-in fade-in zoom-in-95 duration-700 transition-opacity"
              style={{ opacity: portraitOpacity }}
            >
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

        {/* Decorative Scroll Indicator - fades out with content */}
        <div
          className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10 animate-bounce transition-opacity"
          style={{ opacity: contentOpacity }}
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
