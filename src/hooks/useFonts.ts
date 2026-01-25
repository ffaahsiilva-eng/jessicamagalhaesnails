import { useEffect, useRef, useMemo } from "react";
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

const applyFontStyles = (
  displayFont: string,
  bodyFont: string,
  scale: number,
  headingSize: string,
  bodySize: string
) => {
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
};

const updateFontLink = (displayFont: string, bodyFont: string) => {
  let link = document.getElementById("dynamic-fonts") as HTMLLinkElement;
  if (!link) {
    link = document.createElement("link");
    link.id = "dynamic-fonts";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
  
  const displayFontUrl = displayFont.replace(/ /g, "+");
  const bodyFontUrl = bodyFont.replace(/ /g, "+");
  link.href = `https://fonts.googleapis.com/css2?family=${displayFontUrl}:wght@300;400;500;600;700&family=${bodyFontUrl}:wght@300;400;500;600;700&display=swap`;
};

export const useFonts = () => {
  const { getSetting, isLoading } = useSiteSettings();
  const isInitialized = useRef(false);

  // Get current settings with memoization
  const currentSettings = useMemo(() => {
    if (isLoading) {
      return {
        displayFont: defaultFonts.font_display,
        bodyFont: defaultFonts.font_body,
        scale: 1,
        headingSize: defaultFonts.font_heading_size,
        bodySize: defaultFonts.font_body_size,
      };
    }
    
    return {
      displayFont: getSetting("font_display", defaultFonts.font_display),
      bodyFont: getSetting("font_body", defaultFonts.font_body),
      scale: parseFloat(getSetting("font_scale", defaultFonts.font_scale)) || 1,
      headingSize: getSetting("font_heading_size", defaultFonts.font_heading_size),
      bodySize: getSetting("font_body_size", defaultFonts.font_body_size),
    };
  }, [getSetting, isLoading]);

  // Single effect to apply all font styles
  useEffect(() => {
    const { displayFont, bodyFont, scale, headingSize, bodySize } = currentSettings;
    
    // Apply styles
    applyFontStyles(displayFont, bodyFont, scale, headingSize, bodySize);
    
    // Update font link only after initialization or when fonts change
    if (!isInitialized.current || !isLoading) {
      updateFontLink(displayFont, bodyFont);
      isInitialized.current = true;
    }
  }, [currentSettings, isLoading]);
};
