import { useEffect } from "react";
import { useSiteSettings } from "./useSiteSettings";

const defaultFonts = {
  font_display: "Cormorant Garamond",
  font_body: "Montserrat",
  font_scale: "1",
  font_heading_size: "normal",
  font_body_size: "normal",
};

const headingScales: Record<string, number> = {
  small: 0.85,
  normal: 1,
  large: 1.15,
  xlarge: 1.3,
};

const bodyScales: Record<string, number> = {
  small: 0.9,
  normal: 1,
  large: 1.1,
  xlarge: 1.2,
};

export const useFonts = () => {
  const { getSetting, isLoading } = useSiteSettings();

  useEffect(() => {
    if (isLoading) return;

    const displayFont = getSetting("font_display") || defaultFonts.font_display;
    const bodyFont = getSetting("font_body") || defaultFonts.font_body;
    const scale = parseFloat(getSetting("font_scale") || defaultFonts.font_scale);
    const headingSize = getSetting("font_heading_size") || defaultFonts.font_heading_size;
    const bodySize = getSetting("font_body_size") || defaultFonts.font_body_size;

    // Update the Google Fonts link
    let link = document.getElementById("dynamic-fonts") as HTMLLinkElement;
    if (!link) {
      link = document.createElement("link");
      link.id = "dynamic-fonts";
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }

    link.href = `https://fonts.googleapis.com/css2?family=${displayFont.replace(/ /g, "+")}:wght@300;400;500;600;700&family=${bodyFont.replace(/ /g, "+")}:wght@300;400;500;600;700&display=swap`;

    const root = document.documentElement;

    // Apply font families
    root.style.setProperty("--font-display", `"${displayFont}", serif`);
    root.style.setProperty("--font-body", `"${bodyFont}", sans-serif`);

    // Get size multipliers
    const headingScale = headingScales[headingSize] || 1;
    const bodyScale = bodyScales[bodySize] || 1;

    // Apply font sizes with scale
    const baseSize = 16 * scale;
    root.style.setProperty("--font-size-base", `${baseSize * bodyScale}px`);
    root.style.setProperty("--font-size-sm", `${baseSize * bodyScale * 0.875}px`);
    root.style.setProperty("--font-size-xs", `${baseSize * bodyScale * 0.75}px`);
    root.style.setProperty("--font-size-lg", `${baseSize * bodyScale * 1.125}px`);
    root.style.setProperty("--font-size-xl", `${baseSize * bodyScale * 1.25}px`);

    // Heading sizes
    root.style.setProperty("--font-size-h1", `${baseSize * headingScale * 2.5}px`);
    root.style.setProperty("--font-size-h2", `${baseSize * headingScale * 2}px`);
    root.style.setProperty("--font-size-h3", `${baseSize * headingScale * 1.5}px`);
    root.style.setProperty("--font-size-h4", `${baseSize * headingScale * 1.25}px`);

  }, [getSetting, isLoading]);
};
