import { useEffect } from "react";
import { useSiteSettings } from "./useSiteSettings";

const defaultFonts = {
  font_display: "Cormorant Garamond",
  font_body: "Montserrat",
};

export const useFonts = () => {
  const { getSetting, isLoading } = useSiteSettings();

  useEffect(() => {
    if (isLoading) return;

    const displayFont = getSetting("font_display") || defaultFonts.font_display;
    const bodyFont = getSetting("font_body") || defaultFonts.font_body;

    // Update the Google Fonts link
    let link = document.getElementById("dynamic-fonts") as HTMLLinkElement;
    if (!link) {
      link = document.createElement("link");
      link.id = "dynamic-fonts";
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    
    link.href = `https://fonts.googleapis.com/css2?family=${displayFont.replace(/ /g, "+")}:wght@300;400;500;600;700&family=${bodyFont.replace(/ /g, "+")}:wght@300;400;500;600;700&display=swap`;

    // Apply to CSS custom properties
    document.documentElement.style.setProperty("--font-display", `"${displayFont}", serif`);
    document.documentElement.style.setProperty("--font-body", `"${bodyFont}", sans-serif`);

  }, [getSetting, isLoading]);
};
