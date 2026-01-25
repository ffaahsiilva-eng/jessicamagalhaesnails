import { useEffect } from "react";
import { useSiteSettings } from "./useSiteSettings";

const defaultTheme = {
  theme_primary_h: "350",
  theme_primary_s: "60",
  theme_primary_l: "65",
  theme_accent_h: "15",
  theme_accent_s: "70",
  theme_accent_l: "75",
  theme_background_h: "20",
  theme_background_s: "33",
  theme_background_l: "98",
};

export const useThemeColors = () => {
  const { getSetting, isLoading } = useSiteSettings();

  useEffect(() => {
    if (isLoading) return;

    const root = document.documentElement;

    // Primary color
    const ph = getSetting("theme_primary_h") || defaultTheme.theme_primary_h;
    const ps = getSetting("theme_primary_s") || defaultTheme.theme_primary_s;
    const pl = getSetting("theme_primary_l") || defaultTheme.theme_primary_l;
    root.style.setProperty("--primary", `${ph} ${ps}% ${pl}%`);
    root.style.setProperty("--ring", `${ph} ${ps}% ${pl}%`);
    root.style.setProperty("--sidebar-primary", `${ph} ${ps}% ${pl}%`);
    root.style.setProperty("--sidebar-ring", `${ph} ${ps}% ${pl}%`);

    // Accent color (rose gold)
    const ah = getSetting("theme_accent_h") || defaultTheme.theme_accent_h;
    const as = getSetting("theme_accent_s") || defaultTheme.theme_accent_s;
    const al = getSetting("theme_accent_l") || defaultTheme.theme_accent_l;
    root.style.setProperty("--accent", `${ah} ${as}% ${al}%`);
    root.style.setProperty("--rose-gold", `${ah} ${as}% ${al}%`);
    root.style.setProperty("--sidebar-accent", `${ah} ${as}% ${al}%`);

    // Background color
    const bh = getSetting("theme_background_h") || defaultTheme.theme_background_h;
    const bs = getSetting("theme_background_s") || defaultTheme.theme_background_s;
    const bl = getSetting("theme_background_l") || defaultTheme.theme_background_l;
    root.style.setProperty("--background", `${bh} ${bs}% ${bl}%`);
    root.style.setProperty("--sidebar-background", `${bh} ${bs}% ${bl}%`);

    // Derive related colors
    // Muted based on background
    root.style.setProperty("--muted", `${bh} 20% 95%`);
    
    // Secondary based on background  
    root.style.setProperty("--secondary", `${bh} 30% 92%`);
    root.style.setProperty("--sidebar-accent", `${bh} 30% 92%`);

    // Border based on background
    root.style.setProperty("--border", `${bh} 20% 88%`);
    root.style.setProperty("--input", `${bh} 20% 88%`);
    root.style.setProperty("--sidebar-border", `${bh} 20% 88%`);

    // Blush based on primary
    root.style.setProperty("--blush", `${ph} ${ps}% 90%`);
    
    // Deep rose based on primary
    root.style.setProperty("--deep-rose", `${ph} 45% 35%`);

  }, [getSetting, isLoading]);
};
