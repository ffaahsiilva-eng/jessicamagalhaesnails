import { memo } from "react";
import { useAdminEdit } from "@/contexts/AdminEditContext";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { Palette } from "lucide-react";

const services = [
  "ALONGAMENTO EM GEL",
  "FRANCESINHA",
  "NAIL ART",
  "ESMALTAÇÃO EM GEL",
  "BANHO DE GEL",
  "PEDICURE",
];

export const ServiceMarquee = memo(() => {
  const { isEditMode, isAdmin, getDraftSetting, setIsStyleDrawerOpen } = useAdminEdit();
  const { getSetting } = useSiteSettings();

  const bgColor = getDraftSetting("marquee_bg_color") || getSetting("marquee_bg_color", "#2b1a12");
  const textColor = getDraftSetting("marquee_text_color") || getSetting("marquee_text_color", "#f3ddd2");
  const starColor = getDraftSetting("marquee_star_color") || getSetting("marquee_star_color", "#c69a5d");

  return (
    <div className="relative w-full overflow-hidden py-3 select-none group">
      {isAdmin && isEditMode && (
        <button
          type="button"
          onClick={() => setIsStyleDrawerOpen(true)}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 bg-card/90 text-foreground border border-primary/40 px-3 py-1.5 rounded-full shadow-lg text-xs font-body flex items-center gap-1.5 hover:scale-105 transition-transform"
        >
          <Palette className="h-3.5 w-3.5 text-primary" />
          Mudar Cor da Faixa
        </button>
      )}

      <div
        className="w-full py-3 sm:py-3.5 shadow-md overflow-hidden transition-colors duration-300"
        style={{
          backgroundColor: bgColor,
          transform: "rotate(-1.2deg) scale(1.02)",
          transformOrigin: "center center",
        }}
      >
        <div className="flex w-max animate-marquee whitespace-nowrap will-change-transform">
          {/* Repetição 1 */}
          <div className="flex items-center shrink-0">
            {services.map((service, idx) => (
              <span
                key={`s1-${idx}`}
                className="inline-flex items-center text-sm sm:text-base md:text-lg uppercase font-medium"
                style={{
                  color: textColor,
                  fontFamily: "'Playfair Display', serif",
                  letterSpacing: "0.14em",
                }}
              >
                <span className="mx-4 sm:mx-6 md:mx-8">{service}</span>
                <span style={{ color: starColor }} className="text-xs sm:text-sm" aria-hidden="true">
                  ✦
                </span>
              </span>
            ))}
            {services.map((service, idx) => (
              <span
                key={`s1b-${idx}`}
                className="inline-flex items-center text-sm sm:text-base md:text-lg uppercase font-medium"
                style={{
                  color: textColor,
                  fontFamily: "'Playfair Display', serif",
                  letterSpacing: "0.14em",
                }}
              >
                <span className="mx-4 sm:mx-6 md:mx-8">{service}</span>
                <span style={{ color: starColor }} className="text-xs sm:text-sm" aria-hidden="true">
                  ✦
                </span>
              </span>
            ))}
          </div>

          {/* Repetição 2 (loop contínuo de 0 a -50%) */}
          <div className="flex items-center shrink-0" aria-hidden="true">
            {services.map((service, idx) => (
              <span
                key={`s2-${idx}`}
                className="inline-flex items-center text-sm sm:text-base md:text-lg uppercase font-medium"
                style={{
                  color: textColor,
                  fontFamily: "'Playfair Display', serif",
                  letterSpacing: "0.14em",
                }}
              >
                <span className="mx-4 sm:mx-6 md:mx-8">{service}</span>
                <span style={{ color: starColor }} className="text-xs sm:text-sm" aria-hidden="true">
                  ✦
                </span>
              </span>
            ))}
            {services.map((service, idx) => (
              <span
                key={`s2b-${idx}`}
                className="inline-flex items-center text-sm sm:text-base md:text-lg uppercase font-medium"
                style={{
                  color: textColor,
                  fontFamily: "'Playfair Display', serif",
                  letterSpacing: "0.14em",
                }}
              >
                <span className="mx-4 sm:mx-6 md:mx-8">{service}</span>
                <span style={{ color: starColor }} className="text-xs sm:text-sm" aria-hidden="true">
                  ✦
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

ServiceMarquee.displayName = "ServiceMarquee";

export default ServiceMarquee;
